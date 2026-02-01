package com.sharemechat.controller;

import com.sharemechat.dto.ForgotPasswordRequest;
import com.sharemechat.dto.ResetPasswordRequest;
import com.sharemechat.service.PasswordResetService;
import com.sharemechat.service.UserService;
import com.sharemechat.config.IpConfig;
import com.sharemechat.service.ApiRateLimitService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth/password")
public class PasswordResetController {

    private final PasswordResetService passwordResetService;
    private final UserService userService;
    private final ApiRateLimitService rateLimitService;


    public PasswordResetController(PasswordResetService passwordResetService, UserService userService,ApiRateLimitService rateLimitService) {
        this.passwordResetService = passwordResetService;
        this.userService = userService;
        this. rateLimitService = rateLimitService;
    }

    // 1) Inicia el proceso (si el email existe, genera token y “envía” email)
    @PostMapping("/forgot")
    public ResponseEntity<String> forgot(@RequestBody @Valid ForgotPasswordRequest req, HttpServletRequest httpReq) {

        // Rate limit por EMAIL real (industrial)
        rateLimitService.checkPasswordResetEmail(req.getEmail());

        String ip = IpConfig.getClientIp(httpReq);
        String ua = httpReq.getHeader("User-Agent");

        passwordResetService.createAndSendToken(req.getEmail(), ip, ua);

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
