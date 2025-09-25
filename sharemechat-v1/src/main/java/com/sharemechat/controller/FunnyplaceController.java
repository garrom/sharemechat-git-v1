package com.sharemechat.controller;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.FunnyplaceItemDTO;
import com.sharemechat.entity.User;
import com.sharemechat.service.FunnyplaceService;
import com.sharemechat.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/funnyplace")
public class FunnyplaceController {

    private final FunnyplaceService funnyplaceService;
    private final UserService userService;

    public FunnyplaceController(FunnyplaceService funnyplaceService, UserService userService) {
        this.funnyplaceService = funnyplaceService;
        this.userService = userService;
    }

    /**
     * Devuelve un (1) vídeo aleatorio de una modelo verificada.
     * Acceso recomendado: ROLE_CLIENT (clientes) — cambia a tu gusto.
     */
    @GetMapping("/random")
    public ResponseEntity<?> getRandom(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(401).body("No autenticado");
        }

        User me = userService.findByEmail(authentication.getName());
        if (me == null) {
            return ResponseEntity.status(401).body("Usuario no encontrado");
        }

        // Restringir a CLIENT si así lo deseas:
        if (!Constants.Roles.CLIENT.equals(me.getRole())) {
            return ResponseEntity.status(403).body("Solo clientes pueden acceder a Funnyplace");
        }

        FunnyplaceItemDTO item = funnyplaceService.pickRandom();
        if (item == null) {
            // Sin candidatos
            return ResponseEntity.noContent().build();
        }

        // Devolver SOLO lo que espera el frontend (puedes incluir modelId si te interesa)
        Map<String, Object> body = new HashMap<>();
        body.put("videoUrl", item.getVideoUrl());
        body.put("modelName", item.getModelName());
        body.put("avatarUrl", item.getAvatarUrl());
        body.put("modelId", item.getModelId()); // opcional, útil para telemetría

        return ResponseEntity.ok(body);
    }
}
