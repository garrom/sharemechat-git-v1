package com.sharemechat.support.controller;

import com.sharemechat.config.IpConfig;
import com.sharemechat.entity.User;
import com.sharemechat.service.UserService;
import com.sharemechat.support.dto.SupportMessageRequestDTO;
import com.sharemechat.support.dto.SupportMessageResponseDTO;
import com.sharemechat.support.entity.SupportConversation;
import com.sharemechat.support.service.SupportBotService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Endpoint publico autenticado del chat soporte LLM (DEC-CS-7 + DEC-CS-8).
 * REST sincrono, sin WebSocket.
 */
@RestController
@RequestMapping("/api/support")
public class SupportController {

    private final SupportBotService botService;
    private final UserService userService;

    public SupportController(SupportBotService botService, UserService userService) {
        this.botService = botService;
        this.userService = userService;
    }

    @PostMapping("/message")
    public ResponseEntity<?> sendMessage(@RequestBody SupportMessageRequestDTO body,
                                          Authentication auth,
                                          HttpServletRequest req) {
        try {
            Long userId = requireUserId(auth);
            String ip = IpConfig.getClientIp(req);
            SupportMessageResponseDTO out = botService.handleUserMessage(
                    userId, body == null ? null : body.getMessage(), ip);
            return ResponseEntity.ok(out);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/conversations/{id}/escalate-manual")
    public ResponseEntity<?> escalateManual(@PathVariable Long id,
                                             @RequestBody(required = false) Map<String, String> body,
                                             Authentication auth) {
        try {
            Long userId = requireUserId(auth);
            String reason = body == null ? null : body.get("reason");
            SupportConversation conv = botService.escalateManual(userId, reason);
            return ResponseEntity.ok(Map.of(
                    "conversationId", conv.getId(),
                    "resolutionStatus", conv.getResolutionStatus(),
                    "escalationReason", conv.getEscalationReason() == null ? "" : conv.getEscalationReason()
            ));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    private Long requireUserId(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            throw new IllegalArgumentException("No autenticado");
        }
        User u = userService.findByEmail(auth.getName());
        if (u == null) throw new IllegalArgumentException("Usuario no encontrado");
        return u.getId();
    }
}
