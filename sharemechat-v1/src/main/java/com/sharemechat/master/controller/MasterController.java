package com.sharemechat.master.controller;

import com.sharemechat.config.IpConfig;
import com.sharemechat.dto.KycStartSessionResponseDTO;
import com.sharemechat.entity.User;
import com.sharemechat.exception.NicknameAlreadyInUseException;
import com.sharemechat.exception.UnderageModelException;
import com.sharemechat.master.dto.RegisterMasterRequestDTO;
import com.sharemechat.master.service.MasterContractService;
import com.sharemechat.master.service.MasterService;
import com.sharemechat.service.KycSessionService;
import com.sharemechat.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * ADR-056 Fase S2: endpoints publicos + autenticados del rol MASTER.
 *
 * <ul>
 *   <li>{@code POST /api/masters/register} — publico (analog registro
 *       modelo). Crea User + Master + envia email verificacion.</li>
 *   <li>{@code GET /api/masters/me/contract} — devuelve version vigente
 *       del contrato Master (para mostrarlo antes de firmar).</li>
 *   <li>{@code POST /api/masters/me/contract/accept} — firma contrato
 *       Master (idempotente).</li>
 *   <li>{@code POST /api/masters/me/kyc/didit} — arranca sesion KYC
 *       Didit persona fisica. Requiere contrato Master aceptado.</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/masters")
public class MasterController {

    private static final Map<String, String> REGISTER_UNIFORM_BODY = Map.of(
            "message", "Si el email es valido y no esta registrado, recibiras un email de verificacion."
    );

    private final MasterService masterService;
    private final MasterContractService masterContractService;
    private final KycSessionService kycSessionService;
    private final UserService userService;

    public MasterController(MasterService masterService,
                            MasterContractService masterContractService,
                            KycSessionService kycSessionService,
                            UserService userService) {
        this.masterService = masterService;
        this.masterContractService = masterContractService;
        this.kycSessionService = kycSessionService;
        this.userService = userService;
    }

    // ============================================================
    // POST /register — publico
    // ============================================================

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody @Valid RegisterMasterRequestDTO dto,
                                       HttpServletRequest request) {
        String ip = IpConfig.getClientIp(request);
        String acceptLanguage = request.getHeader("Accept-Language");
        try {
            masterService.registerMaster(dto, ip, acceptLanguage);
        } catch (NicknameAlreadyInUseException | UnderageModelException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
        // Body uniforme: no revelamos si el email existia o no (patron
        // simetrico a registerModel/registerClient).
        return ResponseEntity.ok(REGISTER_UNIFORM_BODY);
    }

    // ============================================================
    // Contrato Master
    // ============================================================

    @GetMapping("/me/contract")
    public ResponseEntity<?> currentContract(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).build();
        }
        try {
            return ResponseEntity.ok(masterContractService.current());
        } catch (Exception ex) {
            return ResponseEntity.status(503).body(Map.of("error", "Contrato Master no disponible"));
        }
    }

    @PostMapping("/me/contract/accept")
    public ResponseEntity<?> acceptContract(HttpServletRequest request, Authentication auth) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).build();
        }
        User user = userService.findByEmail(auth.getName());
        if (user == null) {
            return ResponseEntity.status(401).build();
        }
        String ip = IpConfig.getClientIp(request);
        String userAgent = request.getHeader("User-Agent");
        Map<String, Object> result = masterContractService.accept(user.getId(), ip, userAgent);
        return ResponseEntity.ok(result);
    }

    // ============================================================
    // POST /me/kyc/didit — arranque sesion KYC persona fisica
    // ============================================================

    @PostMapping("/me/kyc/didit")
    public ResponseEntity<?> startDiditKyc(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).build();
        }
        User user = userService.findByEmail(auth.getName());
        if (user == null) {
            return ResponseEntity.status(401).build();
        }
        try {
            KycStartSessionResponseDTO dto = kycSessionService.startDiditMasterSession(user.getId());
            return ResponseEntity.ok(dto);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }
}
