package com.sharemechat.controller;

import com.sharemechat.dto.EmojiPublicDTO;
import com.sharemechat.entity.User;
import com.sharemechat.service.EmojiCatalogService;
import com.sharemechat.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Fase 2 chat P2P: endpoint publico autenticado que sirve el catalogo de
 * emojis del chat filtrado por rol del user autenticado.
 *
 * MODEL -> solo FREE_EMOJI.
 * CLIENT -> todo (FREE_EMOJI + PAID_GIFT).
 *
 * Consumido por DashboardClient / DashboardModel para poblar el picker
 * del chat P2P (sustituye a apiFetch('/gifts') en esos dos ficheros).
 *
 * El endpoint legacy GET /api/gifts sigue vivo por retrocompat con otros
 * consumidores (renderGiftVisual, normalizeGiftMessage) que se apoyan en
 * el shape del GiftPublicDTO.
 */
@RestController
@RequestMapping("/api/products/emojis")
public class ProductEmojiController {

    private final EmojiCatalogService emojiCatalogService;
    private final UserService userService;

    public ProductEmojiController(EmojiCatalogService emojiCatalogService, UserService userService) {
        this.emojiCatalogService = emojiCatalogService;
        this.userService = userService;
    }

    @GetMapping("/available")
    public ResponseEntity<List<EmojiPublicDTO>> getAvailable(Authentication auth) {
        String role = resolveRole(auth);
        return ResponseEntity.ok(emojiCatalogService.getAvailableForRole(role));
    }

    /**
     * Extrae el rol del user autenticado. Si no hay autenticacion o el user
     * no se puede resolver, devuelve MODEL como fallback conservador (solo
     * verá FREE_EMOJI): mejor filtrar por defecto y no exponer PAID_GIFT
     * ante ambigüedad. El filtro de seguridad ya bloquearia el request si
     * la sesion es invalida; esto es defensa en profundidad.
     */
    private String resolveRole(Authentication auth) {
        if (auth == null || auth.getName() == null) return "MODEL";
        User u = userService.findByEmail(auth.getName());
        if (u == null || u.getRole() == null) return "MODEL";
        return u.getRole();
    }
}
