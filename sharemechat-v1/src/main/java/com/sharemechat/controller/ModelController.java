package com.sharemechat.controller;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.ModelDTO;
import com.sharemechat.entity.ModelDocument;
import com.sharemechat.entity.User;
import com.sharemechat.repository.ModelDocumentRepository;
import com.sharemechat.service.ModelService;
import com.sharemechat.service.UserService;
import com.sharemechat.storage.StorageService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/models")
public class ModelController {

    private final ModelService modelService;
    private final UserService userService;
    private final ModelDocumentRepository modelDocumentRepository;
    private final StorageService storageService;

    public ModelController(ModelService modelService,
                           UserService userService,
                           ModelDocumentRepository modelDocumentRepository,
                           StorageService storageService) {
        this.modelService = modelService;
        this.userService = userService;
        this.modelDocumentRepository = modelDocumentRepository;
        this.storageService = storageService;
    }

    @GetMapping("/me")
    public ResponseEntity<?> getMyModelInfo(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No autenticado");
        }

        User user = userService.findByEmail(authentication.getName());
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Usuario no encontrado");
        }

        if (!Constants.Roles.MODEL.equals(user.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Requiere rol MODEL");
        }

        ModelDTO dto = modelService.getModelDTO(user);
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/documents/me")
    public ResponseEntity<?> getMyDocuments(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No autenticado");
        }
        User user = userService.findByEmail(authentication.getName());
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Usuario no encontrado");
        }
        var doc = modelDocumentRepository.findById(user.getId()).orElse(null);

        var body = new java.util.HashMap<String, Object>();
        body.put("userId", user.getId());
        body.put("verificationStatus", user.getVerificationStatus());
        if (doc != null) {
            body.put("urlVerificFront", doc.getUrlVerificFront());
            body.put("urlVerificBack",  doc.getUrlVerificBack());
            body.put("urlVerificDoc",   doc.getUrlVerificDoc());
            body.put("urlPic",          doc.getUrlPic());
            body.put("urlVideo",        doc.getUrlVideo());
            body.put("urlConsent",      doc.getUrlConsent());
            body.put("createdAt",       doc.getCreatedAt());
            body.put("updatedAt",       doc.getUpdatedAt());
        }
        return ResponseEntity.ok(body);
    }

    @PostMapping(value = "/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadDocuments(
            Authentication authentication,
            @RequestPart(value = "idFront",    required = false) MultipartFile idFront,
            @RequestPart(value = "idBack",     required = false) MultipartFile idBack,
            @RequestPart(value = "verificDoc", required = false) MultipartFile verificDoc,
            @RequestPart(value = "pic",        required = false) MultipartFile pic,
            @RequestPart(value = "video",      required = false) MultipartFile video,
            @RequestPart(value = "consent",    required = false) MultipartFile consent
    ) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No autenticado");
        }
        User user = userService.findByEmail(authentication.getName());
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Usuario no encontrado");
        }

        try {
            ModelDocument doc = modelDocumentRepository.findById(user.getId()).orElseGet(() -> {
                var x = new ModelDocument();
                x.setUserId(user.getId());
                return x;
            });

            String base = "models/" + user.getId();

            // Guardamos URLs antiguas por si hay que borrarlas tras reemplazo
            String oldPic  = doc.getUrlPic();
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

            // Borrado best-effort de lo anterior si se ha reemplazado
            if (pic != null && !pic.isEmpty()) {
                try { storageService.deleteByPublicUrl(oldPic); } catch (Exception ignore) {}
            }
            if (video != null && !video.isEmpty()) {
                try { storageService.deleteByPublicUrl(oldVideo); } catch (Exception ignore) {}
            }

            var body = new java.util.HashMap<String, Object>();
            body.put("userId", user.getId());
            body.put("verificationStatus", user.getVerificationStatus());
            body.put("urlVerificFront", doc.getUrlVerificFront());
            body.put("urlVerificBack",  doc.getUrlVerificBack());
            body.put("urlVerificDoc",   doc.getUrlVerificDoc());
            body.put("urlPic",          doc.getUrlPic());
            body.put("urlVideo",        doc.getUrlVideo());
            body.put("urlConsent",      doc.getUrlConsent());
            body.put("createdAt",       doc.getCreatedAt());
            body.put("updatedAt",       doc.getUpdatedAt());
            return ResponseEntity.ok(body);

        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
        }
    }

    /**
     * Eliminar un recurso concreto de los documentos de la modelo.
     * Soporta: field=pic (y opcionalmente field=video para futuro).
     */
    @DeleteMapping("/documents")
    public ResponseEntity<?> deleteModelDocument(Authentication authentication,
                                                 @RequestParam(name = "field") String field) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No autenticado");
        }
        User user = userService.findByEmail(authentication.getName());
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Usuario no encontrado");
        }

        ModelDocument doc = modelDocumentRepository.findById(user.getId()).orElse(null);
        if (doc == null) {
            return ResponseEntity.noContent().build();
        }

        String toDelete = null;

        switch (field) {
            case "pic" -> {
                toDelete = doc.getUrlPic();
                doc.setUrlPic(null);
            }
            case "video" -> {
                toDelete = doc.getUrlVideo();
                doc.setUrlVideo(null);
            }
            default -> {
                return ResponseEntity.badRequest().body("Campo no soportado: " + field);
            }
        }

        modelDocumentRepository.save(doc);

        if (toDelete != null) {
            try { storageService.deleteByPublicUrl(toDelete); } catch (Exception ignore) {}
        }

        return ResponseEntity.noContent().build();
    }
}
