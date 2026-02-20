package com.sharemechat.controller;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.ModelDTO;
import com.sharemechat.entity.ModelDocument;
import com.sharemechat.entity.User;
import com.sharemechat.repository.ModelDocumentRepository;
import com.sharemechat.service.ModelContractService;
import com.sharemechat.service.ModelService;
import com.sharemechat.service.ModelStatsService;
import com.sharemechat.service.UserService;
import com.sharemechat.storage.StorageService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestController
@RequestMapping("/api/models")
public class ModelController {

    private final ModelService modelService;
    private final UserService userService;
    private final ModelDocumentRepository modelDocumentRepository;
    private final StorageService storageService;
    private final ModelStatsService modelStatsService;
    private final ModelContractService modelContractService;
    private static final Logger log = LoggerFactory.getLogger(ModelController.class);

    public ModelController(ModelService modelService,
                           UserService userService,
                           ModelDocumentRepository modelDocumentRepository,
                           StorageService storageService,
                           ModelStatsService modelStatsService,
                           ModelContractService modelContractService) {
        this.modelService = modelService;
        this.userService = userService;
        this.modelDocumentRepository = modelDocumentRepository;
        this.storageService = storageService;
        this.modelStatsService = modelStatsService;
        this.modelContractService = modelContractService;
    }

    // ==========================
    // Helpers
    // ==========================
    private ResponseEntity<?> unauth() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No autenticado");
    }

    private User requireUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) return null;
        return userService.findByEmail(authentication.getName());
    }

    /** Onboarding model: role=USER y userType=FORM_MODEL */
    private boolean isOnboardingModel(User u) {
        return u != null
                && Constants.Roles.USER.equals(u.getRole())
                && Constants.UserTypes.FORM_MODEL.equals(u.getUserType());
    }

    /** Actor válido para endpoints de modelo en onboarding o ya en MODEL */
    private boolean isModelActor(User u) {
        return u != null && (Constants.Roles.MODEL.equals(u.getRole()) || isOnboardingModel(u));
    }

    /** ✅ CONTRATO SOLO PARA ONBOARDING (USER+FORM_MODEL). MODEL no se bloquea. */
    private boolean mustHaveAcceptedContract(User u) {
        return isOnboardingModel(u);
    }

    private boolean hasAcceptedContract(Long userId) {
        return modelContractService.isAccepted(userId);
    }

    // ==========================
    // API: /me (dual)
    // ==========================
    @GetMapping("/me")
    public ResponseEntity<?> getMyModelInfo(Authentication authentication) {
        User user = requireUser(authentication);
        if (user == null) return unauth();

        if (Constants.Roles.MODEL.equals(user.getRole())) {
            ModelDTO dto = modelService.getModelDTO(user);
            return ResponseEntity.ok(dto);
        }

        if (isOnboardingModel(user)) {
            ModelDTO dto = new ModelDTO();
            dto.setUserId(user.getId());
            dto.setStreamingHours(java.math.BigDecimal.ZERO);
            dto.setSaldoActual(java.math.BigDecimal.ZERO);
            dto.setTotalIngresos(java.math.BigDecimal.ZERO);
            return ResponseEntity.ok(dto);
        }

        return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Requiere rol MODEL");
    }

    // ==========================
    // Documents
    // ==========================
    @GetMapping("/documents/me")
    public ResponseEntity<?> getMyDocuments(Authentication authentication) {
        User user = requireUser(authentication);
        if (user == null) return unauth();

        if (!isModelActor(user)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("No autorizado");
        }

        // ✅ SOLO ONBOARDING necesita contrato
        if (mustHaveAcceptedContract(user) && !hasAcceptedContract(user.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Debes aceptar el contrato de modelo");
        }

        var doc = modelDocumentRepository.findById(user.getId()).orElse(null);

        var body = new java.util.HashMap<String, Object>();
        body.put("userId", user.getId());
        body.put("role", user.getRole());
        body.put("userType", user.getUserType());
        body.put("verificationStatus", user.getVerificationStatus());

        if (doc != null) {
            body.put("urlVerificFront", doc.getUrlVerificFront());
            body.put("urlVerificBack", doc.getUrlVerificBack());
            body.put("urlVerificDoc", doc.getUrlVerificDoc());
            body.put("urlPic", doc.getUrlPic());
            body.put("urlVideo", doc.getUrlVideo());
            body.put("urlConsent", doc.getUrlConsent());
            body.put("createdAt", doc.getCreatedAt());
            body.put("updatedAt", doc.getUpdatedAt());
        }

        return ResponseEntity.ok(body);
    }

    @PostMapping(value = "/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadDocuments(
            Authentication authentication,
            @RequestPart(value = "idFront", required = false) MultipartFile idFront,
            @RequestPart(value = "idBack", required = false) MultipartFile idBack,
            @RequestPart(value = "verificDoc", required = false) MultipartFile verificDoc,
            @RequestPart(value = "pic", required = false) MultipartFile pic,
            @RequestPart(value = "video", required = false) MultipartFile video,
            @RequestPart(value = "consent", required = false) MultipartFile consent
    ) throws java.io.IOException {

        User user = requireUser(authentication);
        if (user == null) return unauth();

        if (!isModelActor(user)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("No autorizado");
        }

        // ✅ SOLO ONBOARDING necesita contrato
        if (mustHaveAcceptedContract(user) && !hasAcceptedContract(user.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Debes aceptar el contrato de modelo");
        }

        ModelDocument doc = modelDocumentRepository.findById(user.getId()).orElseGet(() -> {
            var x = new ModelDocument();
            x.setUserId(user.getId());
            return x;
        });

        String base = "models/" + user.getId();

        String oldPic = doc.getUrlPic();
        String oldVideo = doc.getUrlVideo();

        if (idFront != null && !idFront.isEmpty()) {
            String url = storageService.store(idFront, base + "/verification");
            doc.setUrlVerificFront(url);
        }
        if (idBack != null && !idBack.isEmpty()) {
            String url = storageService.store(idBack, base + "/verification");
            doc.setUrlVerificBack(url);
        }
        if (verificDoc != null && !verificDoc.isEmpty()) {
            String url = storageService.store(verificDoc, base + "/verification");
            doc.setUrlVerificDoc(url);
        }
        if (pic != null && !pic.isEmpty()) {
            String url = storageService.store(pic, base + "/profile");
            doc.setUrlPic(url);
        }
        if (video != null && !video.isEmpty()) {
            String url = storageService.store(video, base + "/profile");
            doc.setUrlVideo(url);
        }
        if (consent != null && !consent.isEmpty()) {
            String url = storageService.store(consent, base + "/verification");
            doc.setUrlConsent(url);
        }

        modelDocumentRepository.save(doc);

        if (pic != null && !pic.isEmpty()) {
            try { storageService.deleteByPublicUrl(oldPic); } catch (Exception ignore) {}
        }
        if (video != null && !video.isEmpty()) {
            try { storageService.deleteByPublicUrl(oldVideo); } catch (Exception ignore) {}
        }

        var body = new java.util.HashMap<String, Object>();
        body.put("userId", user.getId());
        body.put("role", user.getRole());
        body.put("userType", user.getUserType());
        body.put("verificationStatus", user.getVerificationStatus());
        body.put("urlVerificFront", doc.getUrlVerificFront());
        body.put("urlVerificBack", doc.getUrlVerificBack());
        body.put("urlVerificDoc", doc.getUrlVerificDoc());
        body.put("urlPic", doc.getUrlPic());
        body.put("urlVideo", doc.getUrlVideo());
        body.put("urlConsent", doc.getUrlConsent());
        body.put("createdAt", doc.getCreatedAt());
        body.put("updatedAt", doc.getUpdatedAt());
        return ResponseEntity.ok(body);
    }

    @DeleteMapping("/documents")
    public ResponseEntity<?> deleteModelDocument(Authentication authentication,
                                                 @RequestParam(name = "field") String field) {
        User user = requireUser(authentication);
        if (user == null) return unauth();

        if (!isModelActor(user)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("No autorizado");
        }

        // ✅ SOLO ONBOARDING necesita contrato
        if (mustHaveAcceptedContract(user) && !hasAcceptedContract(user.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Debes aceptar el contrato de modelo");
        }

        ModelDocument doc = modelDocumentRepository.findById(user.getId()).orElse(null);
        if (doc == null) {
            return ResponseEntity.noContent().build();
        }

        String toDelete = null;
        switch (field) {
            case "idFront" -> { toDelete = doc.getUrlVerificFront(); doc.setUrlVerificFront(null); }
            case "idBack" -> { toDelete = doc.getUrlVerificBack(); doc.setUrlVerificBack(null); }
            case "verificDoc" -> { toDelete = doc.getUrlVerificDoc(); doc.setUrlVerificDoc(null); }
            case "pic" -> { toDelete = doc.getUrlPic(); doc.setUrlPic(null); }
            case "video" -> { toDelete = doc.getUrlVideo(); doc.setUrlVideo(null); }
            default -> { return ResponseEntity.badRequest().body("Campo no soportado: " + field); }
        }

        modelDocumentRepository.save(doc);

        if (toDelete != null) {
            try { storageService.deleteByPublicUrl(toDelete); } catch (Exception ignore) {}
        }

        return ResponseEntity.noContent().build();
    }

    // Teasers (sin cambios)
    @GetMapping("/teasers")
    public ResponseEntity<?> getModelTeasers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication) {

        User user = requireUser(authentication);
        if (user == null) return unauth();

        String role = user.getRole();
        boolean allowed =
                Constants.Roles.USER.equals(role) ||
                        Constants.Roles.CLIENT.equals(role) ||
                        Constants.Roles.MODEL.equals(role) ||
                        Constants.Roles.ADMIN.equals(role);

        if (!allowed) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("No autorizado");
        }

        var teasers = modelService.listTeasers(page, size);
        return ResponseEntity.ok(teasers);
    }

    // Stats (solo MODEL real)
    @GetMapping("/stats/summary")
    public ResponseEntity<?> getMyStatsSummary(Authentication authentication) {
        User user = requireUser(authentication);
        if (user == null) return unauth();
        if (!Constants.Roles.MODEL.equals(user.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Requiere rol MODEL");
        }
        return ResponseEntity.ok(modelStatsService.getMySummary(user.getId()));
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getMyStats(Authentication authentication,
                                        @RequestParam(name = "days", defaultValue = "30") int days) {
        User user = requireUser(authentication);
        if (user == null) return unauth();
        if (!Constants.Roles.MODEL.equals(user.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Requiere rol MODEL");
        }
        return ResponseEntity.ok(modelStatsService.getMyStats(user.getId(), days));
    }
}
