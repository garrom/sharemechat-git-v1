package com.sharemechat.master.controller;

import com.sharemechat.entity.User;
import com.sharemechat.master.dto.ActivateMasterModelRequestDTO;
import com.sharemechat.master.dto.CreateMasterModelRequestDTO;
import com.sharemechat.master.dto.MasterInvitationInfoDTO;
import com.sharemechat.master.dto.MasterModelViewDTO;
import com.sharemechat.master.dto.UpdateInternalShareRequestDTO;
import com.sharemechat.master.service.MasterModelInvitationService;
import com.sharemechat.master.service.MasterModelManagementService;
import com.sharemechat.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * ADR-056 Fase S4: endpoints autenticados del Master para gestionar
 * modelos bajo su umbrella + endpoint publico de activacion de la modelo
 * invitada.
 */
@RestController
@RequestMapping("/api/masters")
public class MasterModelController {

    private final MasterModelInvitationService invitationService;
    private final MasterModelManagementService managementService;
    private final UserService userService;

    public MasterModelController(MasterModelInvitationService invitationService,
                                  MasterModelManagementService managementService,
                                  UserService userService) {
        this.invitationService = invitationService;
        this.managementService = managementService;
        this.userService = userService;
    }

    // ============================================================
    // POST /me/models — invita a una modelo bajo umbrella
    // ============================================================

    @PostMapping("/me/models")
    public ResponseEntity<?> invite(@RequestBody @Valid CreateMasterModelRequestDTO body,
                                     Authentication auth) {
        Long masterId = requireMasterId(auth);
        if (masterId == null) return ResponseEntity.status(401).build();
        try {
            Long modelId = invitationService.inviteModel(masterId, body);
            return ResponseEntity.ok(Map.of(
                    "ok", true,
                    "modelUserId", modelId,
                    "message", "Modelo invitada. Le hemos enviado un email de activacion."
            ));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    // ============================================================
    // GET /me/models — listado sin PII
    // ============================================================

    @GetMapping("/me/models")
    public ResponseEntity<?> listMine(Authentication auth) {
        Long masterId = requireMasterId(auth);
        if (masterId == null) return ResponseEntity.status(401).build();
        List<MasterModelViewDTO> list = managementService.listMyModels(masterId);
        return ResponseEntity.ok(list);
    }

    @GetMapping("/me/models/{id}")
    public ResponseEntity<?> getMine(@PathVariable Long id, Authentication auth) {
        Long masterId = requireMasterId(auth);
        if (masterId == null) return ResponseEntity.status(401).build();
        try {
            MasterModelViewDTO v = managementService.getMyModel(masterId, id);
            return ResponseEntity.ok(v);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(404).body(Map.of("error", ex.getMessage()));
        }
    }

    // ============================================================
    // PATCH /me/models/{id}/active — activar/desactivar
    // ============================================================

    @PatchMapping("/me/models/{id}/active")
    public ResponseEntity<?> setActive(@PathVariable Long id,
                                        @RequestBody Map<String, Boolean> body,
                                        Authentication auth) {
        Long masterId = requireMasterId(auth);
        if (masterId == null) return ResponseEntity.status(401).build();
        Boolean active = body != null ? body.get("active") : null;
        if (active == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "active requerido (true/false)"));
        }
        try {
            MasterModelViewDTO v = managementService.setActive(masterId, id, active);
            return ResponseEntity.ok(v);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(404).body(Map.of("error", ex.getMessage()));
        }
    }

    // ============================================================
    // PATCH /me/models/{id}/internal-share — registra % pactado
    // ============================================================

    @PatchMapping("/me/models/{id}/internal-share")
    public ResponseEntity<?> setInternalShare(@PathVariable Long id,
                                               @RequestBody @Valid UpdateInternalShareRequestDTO body,
                                               Authentication auth) {
        Long masterId = requireMasterId(auth);
        if (masterId == null) return ResponseEntity.status(401).build();
        try {
            var split = managementService.setInternalShare(
                    masterId, id, body.getInternalSharePct(), body.getNotes());
            return ResponseEntity.ok(Map.of(
                    "ok", true,
                    "modelUserId", id,
                    "internalSharePct", split.getInternalSharePct(),
                    "effectiveFrom", split.getEffectiveFrom().toString()
            ));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(404).body(Map.of("error", ex.getMessage()));
        }
    }

    // ============================================================
    // GET /models/invitation-info/{token} — publico: info previa (no consume)
    // ============================================================

    @GetMapping("/models/invitation-info/{token}")
    public ResponseEntity<?> invitationInfo(@PathVariable String token) {
        try {
            MasterInvitationInfoDTO info = invitationService.getInvitationInfo(token);
            return ResponseEntity.ok(info);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(404).body(Map.of("error", ex.getMessage()));
        }
    }

    // ============================================================
    // POST /models/activate/{token} — publico: la modelo genera su password
    // ============================================================

    @PostMapping("/models/activate/{token}")
    public ResponseEntity<?> activateInvitedModel(@PathVariable String token,
                                                    @RequestBody @Valid ActivateMasterModelRequestDTO body) {
        try {
            Long userId = invitationService.activate(token, body.getPassword());
            return ResponseEntity.ok(Map.of(
                    "ok", true,
                    "userId", userId,
                    "message", "Cuenta activada. Ya puedes iniciar sesion, firmar contrato y pasar KYC."
            ));
        } catch (IllegalArgumentException | IllegalStateException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    // ============================================================
    // Helper: extraer master userId del Authentication
    // ============================================================

    private Long requireMasterId(Authentication auth) {
        if (auth == null || auth.getName() == null) return null;
        User u = userService.findByEmail(auth.getName());
        return u != null ? u.getId() : null;
    }
}
