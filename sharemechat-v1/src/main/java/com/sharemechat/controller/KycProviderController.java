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

    // Webhook proveedor (Veriff)
    @PostMapping("/veriff/webhook")
    public ResponseEntity<Void> veriffWebhook(
            @RequestHeader(value = "X-SIGNATURE", required = false) String signature,
            @RequestBody String rawBody
    ) {
        modelKycSessionService.processVeriffWebhook(rawBody, signature);
        return ResponseEntity.ok().build();
    }
}