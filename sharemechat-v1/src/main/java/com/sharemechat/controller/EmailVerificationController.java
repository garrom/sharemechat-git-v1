package com.sharemechat.controller;

import com.sharemechat.entity.User;
import com.sharemechat.service.EmailVerificationService;
import com.sharemechat.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/email-verification")
public class EmailVerificationController {

    private final EmailVerificationService emailVerificationService;
    private final UserService userService;

    public EmailVerificationController(EmailVerificationService emailVerificationService,
                                       UserService userService) {
        this.emailVerificationService = emailVerificationService;
        this.userService = userService;
    }

    @GetMapping("/confirm")
    public ResponseEntity<?> confirm(@RequestParam String token) {
        try {
            return ResponseEntity.ok(emailVerificationService.consumeVerificationToken(token));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "ok", false,
                    "message", ex.getMessage()
            ));
        }
    }

    @PostMapping("/resend")
    public ResponseEntity<?> resend(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(401).body(Map.of(
                    "ok", false,
                    "message", "No autenticado"
            ));
        }

        User user = userService.findByEmail(authentication.getName());
        if (user == null) {
            return ResponseEntity.status(404).body(Map.of(
                    "ok", false,
                    "message", "Usuario no encontrado"
            ));
        }

        if (emailVerificationService.isEmailVerified(user)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "ok", false,
                    "message", "El email ya esta validado."
            ));
        }

        emailVerificationService.issueProductVerification(user);

        return ResponseEntity.ok(Map.of(
                "ok", true,
                "message", "Hemos reenviado el email de validacion."
        ));
    }
}
