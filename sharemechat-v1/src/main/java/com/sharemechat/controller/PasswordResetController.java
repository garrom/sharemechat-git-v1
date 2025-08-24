package com.sharemechat.controller;

import com.sharemechat.dto.ForgotPasswordRequest;
import com.sharemechat.dto.ResetPasswordRequest;
import com.sharemechat.service.PasswordResetService;
import com.sharemechat.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth/password")
public class PasswordResetController {

    private final PasswordResetService passwordResetService;
    private final UserService userService;

    public PasswordResetController(PasswordResetService passwordResetService, UserService userService) {
        this.passwordResetService = passwordResetService;
        this.userService = userService;
    }

    // 1) Inicia el proceso (si el email existe, genera token y “envía” email)
    @PostMapping("/forgot")
    public ResponseEntity<String> forgot(@RequestBody @Valid ForgotPasswordRequest req) {
        passwordResetService.createAndSendToken(req.getEmail());
        // Respuesta genérica por seguridad (no revelamos si existe o no el email)
        return ResponseEntity.ok("Si el email existe, hemos enviado instrucciones para resetear tu contraseña.");
    }

    // 2) Resetea usando el token + nueva contraseña
    @PostMapping("/reset")
    public ResponseEntity<String> reset(@RequestBody @Valid ResetPasswordRequest req) {
        Long userId = passwordResetService.consumeToken(req.getToken()); // valida+marca usado
        userService.updatePassword(userId, req.getNewPassword());
        return ResponseEntity.ok("Contraseña actualizada correctamente.");
    }
}
