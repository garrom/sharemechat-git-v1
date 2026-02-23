package com.sharemechat.controller;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.ModelDocument;
import com.sharemechat.entity.User;
import com.sharemechat.repository.ModelDocumentRepository;
import com.sharemechat.service.KycProviderConfigService;
import com.sharemechat.service.ModelContractService;
import com.sharemechat.service.UserService;
import com.sharemechat.storage.StorageService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/models/kyc")
public class ModelKycController {

    private final UserService userService;
    private final ModelDocumentRepository modelDocumentRepository;
    private final StorageService storageService;
    private final ModelContractService modelContractService;
    private final KycProviderConfigService kycProviderConfigService;

    public ModelKycController(UserService userService,
                              ModelDocumentRepository modelDocumentRepository,
                              StorageService storageService,
                              ModelContractService modelContractService,
                              KycProviderConfigService kycProviderConfigService) {
        this.userService = userService;
        this.modelDocumentRepository = modelDocumentRepository;
        this.storageService = storageService;
        this.modelContractService = modelContractService;
        this.kycProviderConfigService = kycProviderConfigService;
    }

    private ResponseEntity<?> enforceOnboardingModelAndContract(User user) {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Usuario no encontrado");
        }

        boolean isOnboardingModel =
                Constants.Roles.USER.equals(user.getRole())
                        && Constants.UserTypes.FORM_MODEL.equals(user.getUserType());

        if (!isOnboardingModel) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("No autorizado");
        }

        if (!modelContractService.isAcceptedCurrent(user.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Debes aceptar el contrato de modelo");
        }

        return null;
    }

    // Bloquea flujo manual cuando el modo activo no es MANUAL
    private ResponseEntity<?> enforceManualKycEnabled() {
        if (!kycProviderConfigService.isManualEnabledForModelOnboarding()) {
            String mode = kycProviderConfigService.getActiveModeForModelOnboarding();
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("KYC manual no disponible. Modo activo: " + mode);
        }
        return null;
    }

    /**
     * Endpoint de entrada para que frontend sepa qué flujo abrir.
     * (DashboardUserModel -> decide si ir a Veriff o Manual)
     */
    @GetMapping("/entrypoint")
    public ResponseEntity<?> getKycEntrypoint(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No autenticado");
        }

        User user = userService.findByEmail(authentication.getName());

        ResponseEntity<?> denied = enforceOnboardingModelAndContract(user);
        if (denied != null) return denied;

        String activeMode = kycProviderConfigService.getActiveModeForModelOnboarding();

        var body = new java.util.HashMap<String, Object>();
        body.put("userId", user.getId());
        body.put("userType", user.getUserType());
        body.put("role", user.getRole());
        body.put("verificationStatus", user.getVerificationStatus() != null
                ? user.getVerificationStatus()
                : Constants.VerificationStatuses.PENDING);
        body.put("kycMode", activeMode);

        // flags cómodos para frontend
        body.put("manualEnabled", Constants.KycModes.MANUAL.equalsIgnoreCase(activeMode));
        body.put("veriffEnabled", Constants.KycModes.VERIFF.equalsIgnoreCase(activeMode));

        return ResponseEntity.ok(body);
    }

    @GetMapping("/me")
    public ResponseEntity<?> getMyKyc(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No autenticado");
        }

        User user = userService.findByEmail(authentication.getName());

        ResponseEntity<?> denied = enforceOnboardingModelAndContract(user);
        if (denied != null) return denied;

        ResponseEntity<?> manualDenied = enforceManualKycEnabled();
        if (manualDenied != null) return manualDenied;

        var doc = modelDocumentRepository.findById(user.getId()).orElse(null);

        var body = new java.util.HashMap<String, Object>();
        body.put("userId", user.getId());
        body.put("verificationStatus", user.getVerificationStatus() != null
                ? user.getVerificationStatus()
                : Constants.VerificationStatuses.PENDING);
        body.put("kycMode", kycProviderConfigService.getActiveModeForModelOnboarding());

        if (doc != null) {
            body.put("urlVerificFront", doc.getUrlVerificFront());
            body.put("urlVerificBack",  doc.getUrlVerificBack());
            body.put("urlVerificDoc",   doc.getUrlVerificDoc());
            body.put("urlConsent",      doc.getUrlConsent());
            body.put("createdAt",       doc.getCreatedAt());
            body.put("updatedAt",       doc.getUpdatedAt());
        }

        return ResponseEntity.ok(body);
    }

    @PostMapping(value = "", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadKyc(
            Authentication authentication,
            @RequestPart(value = "idFront",    required = false) MultipartFile idFront,
            @RequestPart(value = "idBack",     required = false) MultipartFile idBack,
            @RequestPart(value = "verificDoc", required = false) MultipartFile verificDoc,
            @RequestPart(value = "consent",    required = false) MultipartFile consent
    ) throws java.io.IOException {

        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No autenticado");
        }

        User user = userService.findByEmail(authentication.getName());

        ResponseEntity<?> denied = enforceOnboardingModelAndContract(user);
        if (denied != null) return denied;

        ResponseEntity<?> manualDenied = enforceManualKycEnabled();
        if (manualDenied != null) return manualDenied;

        if ((idFront == null || idFront.isEmpty())
                && (idBack == null || idBack.isEmpty())
                && (verificDoc == null || verificDoc.isEmpty())
                && (consent == null || consent.isEmpty())) {
            return ResponseEntity.badRequest().body("No se han enviado archivos");
        }

        ModelDocument doc = modelDocumentRepository.findById(user.getId()).orElseGet(() -> {
            var x = new ModelDocument();
            x.setUserId(user.getId());
            return x;
        });

        String base = "models/" + user.getId();

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
        if (consent != null && !consent.isEmpty()) {
            String url = storageService.store(consent, base + "/verification");
            doc.setUrlConsent(url);
        }

        modelDocumentRepository.save(doc);

        var body = new java.util.HashMap<String, Object>();
        body.put("userId", user.getId());
        body.put("verificationStatus", user.getVerificationStatus() != null
                ? user.getVerificationStatus()
                : Constants.VerificationStatuses.PENDING);
        body.put("kycMode", kycProviderConfigService.getActiveModeForModelOnboarding());
        body.put("urlVerificFront", doc.getUrlVerificFront());
        body.put("urlVerificBack", doc.getUrlVerificBack());
        body.put("urlVerificDoc", doc.getUrlVerificDoc());
        body.put("urlConsent", doc.getUrlConsent());
        body.put("createdAt", doc.getCreatedAt());
        body.put("updatedAt", doc.getUpdatedAt());

        return ResponseEntity.ok(body);
    }

    @DeleteMapping("")
    public ResponseEntity<?> deleteKyc(Authentication authentication,
                                       @RequestParam(name = "field") String field) throws java.io.IOException {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No autenticado");
        }

        User user = userService.findByEmail(authentication.getName());

        ResponseEntity<?> denied = enforceOnboardingModelAndContract(user);
        if (denied != null) return denied;

        ResponseEntity<?> manualDenied = enforceManualKycEnabled();
        if (manualDenied != null) return manualDenied;

        ModelDocument doc = modelDocumentRepository.findById(user.getId()).orElse(null);
        if (doc == null) {
            return ResponseEntity.noContent().build();
        }

        String toDelete = null;

        switch (field) {
            case "idFront" -> {
                toDelete = doc.getUrlVerificFront();
                doc.setUrlVerificFront(null);
            }
            case "idBack" -> {
                toDelete = doc.getUrlVerificBack();
                doc.setUrlVerificBack(null);
            }
            case "verificDoc" -> {
                toDelete = doc.getUrlVerificDoc();
                doc.setUrlVerificDoc(null);
            }
            case "consent" -> {
                toDelete = doc.getUrlConsent();
                doc.setUrlConsent(null);
            }
            default -> {
                return ResponseEntity.badRequest().body("Campo no soportado: " + field);
            }
        }

        modelDocumentRepository.save(doc);

        if (toDelete != null) {
            try {
                storageService.deleteByPublicUrl(toDelete);
            } catch (Exception ignore) {
                // noop
            }
        }

        return ResponseEntity.noContent().build();
    }
}