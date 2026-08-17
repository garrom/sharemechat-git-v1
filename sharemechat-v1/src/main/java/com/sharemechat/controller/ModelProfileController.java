package com.sharemechat.controller;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.ModelProfileAttributesDTO;
import com.sharemechat.entity.User;
import com.sharemechat.exception.EmailVerificationRequiredException;
import com.sharemechat.security.ModelContractGate;
import com.sharemechat.service.EmailVerificationService;
import com.sharemechat.service.ModelProfileAttributesService;
import com.sharemechat.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * Card 1 Fase 2: datos físicos del propio modelo (self-service). Mismos
 * gates que {@code ModelAssetController} (actor modelo / onboarding + email
 * verificado + contrato en onboarding). Endpoints:
 * <ul>
 *   <li>{@code GET /api/me/profile-attributes} — leer los propios.</li>
 *   <li>{@code PUT /api/me/profile-attributes} — actualizar (upsert).</li>
 * </ul>
 */
@RestController
public class ModelProfileController {

    private final ModelProfileAttributesService profileAttributesService;
    private final UserService userService;
    private final ModelContractGate modelContractGate;
    private final EmailVerificationService emailVerificationService;

    public ModelProfileController(ModelProfileAttributesService profileAttributesService,
                                  UserService userService,
                                  ModelContractGate modelContractGate,
                                  EmailVerificationService emailVerificationService) {
        this.profileAttributesService = profileAttributesService;
        this.userService = userService;
        this.modelContractGate = modelContractGate;
        this.emailVerificationService = emailVerificationService;
    }

    @GetMapping("/api/me/profile-attributes")
    public ResponseEntity<?> getMyAttributes(Authentication authentication) {
        User user = requireUser(authentication);
        if (user == null) return unauth();
        ResponseEntity<?> gate = gateModelActor(user);
        if (gate != null) return gate;
        return ResponseEntity.ok(profileAttributesService.getForUser(user.getId()));
    }

    @PutMapping("/api/me/profile-attributes")
    public ResponseEntity<?> updateMyAttributes(Authentication authentication,
                                                @RequestBody ModelProfileAttributesDTO body) {
        User user = requireUser(authentication);
        if (user == null) return unauth();
        ResponseEntity<?> gate = gateModelActor(user);
        if (gate != null) return gate;
        try {
            return ResponseEntity.ok(profileAttributesService.update(user.getId(), body));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    // ============================================================
    // Helpers (mismo patrón que ModelAssetController)
    // ============================================================

    private ResponseEntity<?> unauth() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No autenticado");
    }

    private User requireUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) return null;
        return userService.findByEmail(authentication.getName());
    }

    private boolean isOnboardingModel(User u) {
        return u != null
                && Constants.Roles.USER.equals(u.getRole())
                && Constants.UserTypes.FORM_MODEL.equals(u.getUserType());
    }

    private boolean isModelActor(User u) {
        return u != null && (Constants.Roles.MODEL.equals(u.getRole()) || isOnboardingModel(u));
    }

    /** Devuelve un ResponseEntity de error si el actor no puede editar, o null si puede. */
    private ResponseEntity<?> gateModelActor(User user) {
        if (!isModelActor(user)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("No autorizado");
        }
        if (isOnboardingModel(user) && !emailVerificationService.isEmailVerified(user)) {
            throw new EmailVerificationRequiredException(
                    "Debes validar tu email antes de continuar el onboarding de modelo",
                    "MODEL_ONBOARDING",
                    "VERIFY_EMAIL");
        }
        if (modelContractGate.requiresAcceptance(user)
                && !modelContractGate.hasAcceptedCurrent(user.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Debes aceptar el contrato de modelo");
        }
        return null;
    }
}
