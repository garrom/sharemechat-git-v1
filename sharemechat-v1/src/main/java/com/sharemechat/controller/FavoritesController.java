package com.sharemechat.controller;

import com.sharemechat.dto.FavoriteListItemDTO;
import com.sharemechat.dto.UserSummaryDTO;
import com.sharemechat.entity.User;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.FavoriteService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/favorites")
public class FavoritesController {

    private final FavoriteService favoriteService;
    private final UserRepository userRepository;

    public FavoritesController(FavoriteService favoriteService, UserRepository userRepository) {
        this.favoriteService = favoriteService;
        this.userRepository = userRepository;
    }

    // ===== CLIENT -> MODELS =====
    @PostMapping("/models/{modelId}")
    public ResponseEntity<Void> addModel(Authentication auth, @PathVariable Long modelId) {
        Long clientId = currentUserId(auth);
        favoriteService.addModelToClientFavorites(clientId, modelId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/models/{modelId}")
    public ResponseEntity<Void> removeModel(Authentication auth, @PathVariable Long modelId) {
        Long clientId = currentUserId(auth);
        favoriteService.removeModelFromClientFavorites(clientId, modelId);
        return ResponseEntity.noContent().build();
    }

    // ===== MODEL -> CLIENTS =====
    @PostMapping("/clients/{clientId}")
    public ResponseEntity<Void> addClient(Authentication auth, @PathVariable Long clientId) {
        Long modelId = currentUserId(auth);
        favoriteService.addClientToModelFavorites(modelId, clientId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/clients/{clientId}")
    public ResponseEntity<Void> removeClient(Authentication auth, @PathVariable Long clientId) {
        Long modelId = currentUserId(auth);
        favoriteService.removeClientFromModelFavorites(modelId, clientId);
        return ResponseEntity.noContent().build();
    }

    // ===== LISTADOS con metadatos (nuevos) =====
    @GetMapping("/models/meta")
    public ResponseEntity<List<FavoriteListItemDTO>> listModelsMeta(Authentication auth) {
        Long clientId = currentUserId(auth);
        return ResponseEntity.ok(favoriteService.listClientFavoritesMeta(clientId));
    }

    @GetMapping("/clients/meta")
    public ResponseEntity<List<FavoriteListItemDTO>> listClientsMeta(Authentication auth) {
        Long modelId = currentUserId(auth);
        return ResponseEntity.ok(favoriteService.listModelFavoritesMeta(modelId));
    }

    // ===== Aceptar / Rechazar invitación (nuevos) =====
    @PostMapping("/accept/{peerId}")
    public ResponseEntity<Void> accept(Authentication auth, @PathVariable Long peerId) {
        favoriteService.acceptInvitation(currentUserId(auth), peerId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/reject/{peerId}")
    public ResponseEntity<Void> reject(Authentication auth, @PathVariable Long peerId) {
        favoriteService.rejectInvitation(currentUserId(auth), peerId);
        return ResponseEntity.noContent().build();
    }

    private Long currentUserId(Authentication auth) {
        String email = auth.getName(); // establecido por UserDetailsService
        User u = userRepository.findByEmail(email).orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        return u.getId();
    }
}
