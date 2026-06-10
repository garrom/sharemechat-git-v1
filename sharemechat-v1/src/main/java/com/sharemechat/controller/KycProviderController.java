package com.sharemechat.controller;

import com.sharemechat.dto.KycStartSessionResponseDTO;
import com.sharemechat.entity.User;
import com.sharemechat.service.ModelKycSessionService;
import com.sharemechat.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/kyc")
public class KycProviderController {

    private final ModelKycSessionService modelKycSessionService;
    private final UserService userService;

    public KycProviderController(ModelKycSessionService modelKycSessionService, UserService userService) {
        this.modelKycSessionService = modelKycSessionService;
        this.userService = userService;
    }

    // Onboarding model inicia sesión Veriff
    @PostMapping("/veriff/start")
    public ResponseEntity<KycStartSessionResponseDTO> startVeriff(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(401).build();
        }

        User user = userService.findByEmail(authentication.getName());
        if (user == null) {
            return ResponseEntity.status(401).build();
        }

        KycStartSessionResponseDTO dto = modelKycSessionService.startVeriffSession(user.getId());
        return ResponseEntity.ok(dto);
    }

    // Webhook proveedor (Veriff).
    // Header de firma: X-HMAC-SIGNATURE (confirmado por soporte Veriff).
    // Body recibido como byte[] para preservar los bytes crudos exactos que
    // Veriff firmó (evita que la decodificación de Spring altere el payload
    // antes de validar el HMAC). Si la firma es inválida/ausente: 401.
    @PostMapping("/veriff/webhook")
    public ResponseEntity<Void> veriffWebhook(
            @RequestHeader(value = "X-HMAC-SIGNATURE", required = false) String signature,
            @RequestBody(required = false) byte[] rawBody
    ) {
        boolean ok = modelKycSessionService.processVeriffWebhook(rawBody, signature);
        if (!ok) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok().build();
    }
}