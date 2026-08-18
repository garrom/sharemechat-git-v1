package com.sharemechat.controller;

import com.sharemechat.dto.ModelLikeStateDTO;
import com.sharemechat.entity.User;
import com.sharemechat.service.ModelLikeService;
import com.sharemechat.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * Card 1 Fase 3: likes cliente→modelo.
 * <ul>
 *   <li>{@code GET /api/models/{userId}/likes} — estado (count, hasLiked, badge)
 *       para el visor autenticado.</li>
 *   <li>{@code POST /api/models/{userId}/likes/toggle} — da o quita like y
 *       devuelve el estado resultante.</li>
 * </ul>
 * Cualquier usuario autenticado consulta; el toggle valida que el objetivo
 * sea una modelo y que no sea uno mismo (en el service).
 */
@RestController
public class ModelLikeController {

    private final ModelLikeService modelLikeService;
    private final UserService userService;

    public ModelLikeController(ModelLikeService modelLikeService, UserService userService) {
        this.modelLikeService = modelLikeService;
        this.userService = userService;
    }

    @GetMapping("/api/models/{userId}/likes")
    public ResponseEntity<?> getLikes(@PathVariable Long userId, Authentication authentication) {
        User viewer = requireUser(authentication);
        if (viewer == null) return unauth();
        return ResponseEntity.ok(modelLikeService.getState(viewer.getId(), userId));
    }

    @PostMapping("/api/models/{userId}/likes/toggle")
    public ResponseEntity<?> toggleLike(@PathVariable Long userId, Authentication authentication) {
        User viewer = requireUser(authentication);
        if (viewer == null) return unauth();
        try {
            ModelLikeStateDTO state = modelLikeService.toggle(viewer.getId(), userId);
            return ResponseEntity.ok(state);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    private ResponseEntity<?> unauth() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No autenticado");
    }

    private User requireUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) return null;
        return userService.findByEmail(authentication.getName());
    }
}
