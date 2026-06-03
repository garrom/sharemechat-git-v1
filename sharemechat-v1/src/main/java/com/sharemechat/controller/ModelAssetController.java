package com.sharemechat.controller;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.ModelAssetDTO;
import com.sharemechat.dto.ModelPublicProfileDTO;
import com.sharemechat.entity.ModelAsset;
import com.sharemechat.entity.User;
import com.sharemechat.exception.EmailVerificationRequiredException;
import com.sharemechat.exception.UserNotFoundException;
import com.sharemechat.security.ModelContractGate;
import com.sharemechat.service.EmailVerificationService;
import com.sharemechat.service.ModelAssetService;
import com.sharemechat.service.ModelService;
import com.sharemechat.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

/**
 * Endpoints Capa 2 multi-asset:
 * <ul>
 *   <li>{@code GET /api/me/assets} — modelo lista sus propios assets
 *       (cualquier estado) con su {@code reviewStatus}.</li>
 *   <li>{@code POST /api/me/assets} — modelo sube nuevo asset
 *       (multipart, valida límites 5 PIC / 2 VIDEO).</li>
 *   <li>{@code PUT /api/me/assets/{id}/principal} — marcar principal.</li>
 *   <li>{@code DELETE /api/me/assets/{id}} — soft delete con validación
 *       de "no eliminar último aprobado si modelo activo".</li>
 *   <li>{@code GET /api/models/{userId}/assets} — galería pública de un
 *       modelo (solo aprobados activos, principal primero).</li>
 * </ul>
 *
 * <p>Los endpoints {@code /api/me/assets/*} sirven tanto al modelo
 * (role MODEL) como al usuario en onboarding (role USER, userType
 * FORM_MODEL). El usuario en onboarding además requiere email validado
 * y contrato aceptado (mismas reglas que {@code ModelController}).
 */
@RestController
public class ModelAssetController {

    private static final Logger log = LoggerFactory.getLogger(ModelAssetController.class);

    private final ModelAssetService modelAssetService;
    private final ModelService modelService;
    private final UserService userService;
    private final ModelContractGate modelContractGate;
    private final EmailVerificationService emailVerificationService;

    public ModelAssetController(ModelAssetService modelAssetService,
                                ModelService modelService,
                                UserService userService,
                                ModelContractGate modelContractGate,
                                EmailVerificationService emailVerificationService) {
        this.modelAssetService = modelAssetService;
        this.modelService = modelService;
        this.userService = userService;
        this.modelContractGate = modelContractGate;
        this.emailVerificationService = emailVerificationService;
    }

    // ============================================================
    // Endpoints del propio modelo
    // ============================================================

    @GetMapping("/api/me/assets")
    public ResponseEntity<?> listMyAssets(Authentication authentication) {
        User user = requireUser(authentication);
        if (user == null) return unauth();
        if (!isModelActor(user)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("No autorizado");
        }
        ResponseEntity<?> denied = requireVerifiedOnboardingModel(user);
        if (denied != null) return denied;
        if (mustHaveAcceptedContract(user) && !hasAcceptedContract(user.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Debes aceptar el contrato de modelo");
        }

        List<ModelAssetDTO> assets = modelAssetService.listMyAssets(user.getId());
        return ResponseEntity.ok(assets);
    }

    @PostMapping(value = "/api/me/assets", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadAsset(
            Authentication authentication,
            @RequestParam("type") String assetType,
            @RequestPart("file") MultipartFile file
    ) throws IOException {
        User user = requireUser(authentication);
        if (user == null) return unauth();
        if (!isModelActor(user)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("No autorizado");
        }
        ResponseEntity<?> denied = requireVerifiedOnboardingModel(user);
        if (denied != null) return denied;
        if (mustHaveAcceptedContract(user) && !hasAcceptedContract(user.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Debes aceptar el contrato de modelo");
        }

        try {
            ModelAsset asset = modelAssetService.upload(user.getId(), normalizeType(assetType), file);
            // Tras el upload, devolver la vista DTO completa (con status del review nuevo)
            ModelAssetDTO created = modelAssetService.listMyAssets(user.getId()).stream()
                    .filter(dto -> dto.id().equals(asset.getId()))
                    .findFirst()
                    .orElse(null);
            return ResponseEntity.ok(created);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
        }
    }

    @PutMapping("/api/me/assets/{assetId}/principal")
    public ResponseEntity<?> markAsPrincipal(@PathVariable Long assetId,
                                              Authentication authentication) {
        User user = requireUser(authentication);
        if (user == null) return unauth();
        if (!isModelActor(user)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("No autorizado");
        }
        ResponseEntity<?> denied = requireVerifiedOnboardingModel(user);
        if (denied != null) return denied;
        if (mustHaveAcceptedContract(user) && !hasAcceptedContract(user.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Debes aceptar el contrato de modelo");
        }

        try {
            ModelAsset asset = modelAssetService.markPrincipal(user.getId(), assetId);
            return ResponseEntity.ok(asset);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ex.getMessage());
        }
    }

    @DeleteMapping("/api/me/assets/{assetId}")
    public ResponseEntity<?> deleteAsset(@PathVariable Long assetId,
                                          Authentication authentication) {
        User user = requireUser(authentication);
        if (user == null) return unauth();
        if (!isModelActor(user)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("No autorizado");
        }
        ResponseEntity<?> denied = requireVerifiedOnboardingModel(user);
        if (denied != null) return denied;
        if (mustHaveAcceptedContract(user) && !hasAcceptedContract(user.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Debes aceptar el contrato de modelo");
        }

        try {
            modelAssetService.delete(user.getId(), assetId);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
        }
    }

    // ============================================================
    // Endpoint público de galería (vista cliente)
    // ============================================================

    @GetMapping("/api/models/{userId}/assets")
    public ResponseEntity<?> getModelGallery(@PathVariable Long userId,
                                              Authentication authentication) {
        User user = requireUser(authentication);
        if (user == null) return unauth();

        // Cualquier usuario autenticado puede ver la galería pública.
        // El service ya filtra solo aprobados activos.
        List<ModelAssetDTO> assets = modelAssetService.listApprovedForClient(userId);
        return ResponseEntity.ok(assets);
    }

    /**
     * Perfil público del modelo para el modal "Ver perfil completo"
     * (Capa 2 Fase 4). Accesible desde el menú de favoritos del
     * cliente. NO incluye name/surname/email/country.
     *
     * <p>Si el modelo no está disponible (no existe, baja, suspendido,
     * banneado, KYC no aprobado, ...), devuelve 404 con mensaje
     * "Modelo no disponible" para que el frontend muestre el placeholder.
     */
    @GetMapping("/api/models/{userId}/public-profile")
    public ResponseEntity<?> getPublicProfile(@PathVariable Long userId,
                                              Authentication authentication) {
        User viewer = requireUser(authentication);
        if (viewer == null) return unauth();
        try {
            ModelPublicProfileDTO dto = modelService.getPublicProfile(userId);
            return ResponseEntity.ok(dto);
        } catch (UserNotFoundException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ex.getMessage());
        }
    }

    // ============================================================
    // Helpers (replicados desde ModelController para consistencia)
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

    /**
     * Lote endurecimiento 2026-06-04: el gate de contrato aplica a
     * cualquier actor modelo (onboarding USER+FORM_MODEL y role=MODEL),
     * no solo onboarding. Delegado en {@link ModelContractGate}.
     */
    private boolean mustHaveAcceptedContract(User u) {
        return modelContractGate.requiresAcceptance(u);
    }

    private boolean hasAcceptedContract(Long userId) {
        return modelContractGate.hasAcceptedCurrent(userId);
    }

    private ResponseEntity<?> requireVerifiedOnboardingModel(User user) {
        if (isOnboardingModel(user) && !emailVerificationService.isEmailVerified(user)) {
            throw new EmailVerificationRequiredException(
                    "Debes validar tu email antes de continuar el onboarding de modelo",
                    "MODEL_ONBOARDING",
                    "VERIFY_EMAIL"
            );
        }
        return null;
    }

    private static String normalizeType(String t) {
        return t == null ? null : t.trim().toUpperCase();
    }
}
