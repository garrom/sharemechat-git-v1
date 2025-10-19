package com.sharemechat.controller;

import com.sharemechat.dto.FavoriteListItemDTO;
import com.sharemechat.dto.UserSummaryDTO;
import com.sharemechat.entity.User;
import com.sharemechat.handler.MessagesWsHandler;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.FavoriteService;
import com.sharemechat.service.ModelStatusService;
import com.sharemechat.service.StreamService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/favorites")
public class FavoritesController {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(FavoritesController.class);
    private final FavoriteService favoriteService;
    private final UserRepository userRepository;
    private final MessagesWsHandler messagesWsHandler;
    private final ModelStatusService modelStatusService;
    private final StreamService streamService;

    public FavoritesController(FavoriteService favoriteService,
                               UserRepository userRepository,
                               MessagesWsHandler messagesWsHandler,
                               ModelStatusService modelStatusService,
                               StreamService streamService) {
        this.favoriteService = favoriteService;
        this.userRepository = userRepository;
        this.messagesWsHandler = messagesWsHandler;
        this.modelStatusService = modelStatusService;
        this.streamService = streamService;
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

    @GetMapping("/models/meta")
    public ResponseEntity<List<FavoriteListItemDTO>> listModelsMeta(Authentication auth) {
        Long clientId = currentUserId(auth);

        // 1) Obtenemos la lista base (modelos favoritos del cliente)
        List<FavoriteListItemDTO> base = favoriteService.listClientFavoritesMeta(clientId);
        // 2) Enriquecemos con presence usando SIEMPRE el userId de la MODELO
        List<FavoriteListItemDTO> enriched = base.stream().map(item -> {
            Long modelUserId = (item.user() != null) ? item.user().getId() : null;

            String presence = "offline";
            boolean online = false;
            boolean busy = false;

            if (modelUserId != null) {
                // 1) Fuente de verdad para modelos: Redis (ModelStatusService)
                String s = modelStatusService.getStatus(modelUserId); // "AVAILABLE", "BUSY" o null
                if ("BUSY".equals(s)) {
                    busy = true;
                    presence = "busy";
                } else if ("AVAILABLE".equals(s)) {
                    online = true;
                    presence = "online";
                } else {
                    // 2) Fallback opcional: si Redis no tiene estado, infiere online desde /messages
                    online = messagesWsHandler.isUserOnline(modelUserId);
                    presence = online ? "online" : "offline";
                }
            }
            return new FavoriteListItemDTO(
                    item.user(),
                    item.status(),
                    item.invited(),
                    item.direction(),
                    presence
            );
        }).toList();

        return ResponseEntity.ok(enriched);
    }

    @GetMapping("/clients/meta")
    public ResponseEntity<List<FavoriteListItemDTO>> listClientsMeta(Authentication auth) {
        Long modelId = currentUserId(auth);

        List<FavoriteListItemDTO> base = favoriteService.listModelFavoritesMeta(modelId);
        List<FavoriteListItemDTO> enriched = base.stream().map(item -> {
            Long clientUserId = (item.user() != null) ? item.user().getId() : null;

            String presence = "offline";
            boolean online = false;
            boolean busy = false;

            if (clientUserId != null) {
                // Busy si el CLIENTE está en cualquier stream activo (random)
                try {
                    if (streamService.isUserInActiveStream(clientUserId)) {
                        busy = true;
                        presence = "busy";
                    } else {
                        // Si no está busy, inferir online por /messages (o usa tu propia heurística)
                        online = messagesWsHandler.isUserOnline(clientUserId);
                        presence = online ? "online" : "offline";
                    }
                } catch (Exception e) {
                    online = messagesWsHandler.isUserOnline(clientUserId);
                    presence = online ? "online" : "offline";
                }
            }

            return new FavoriteListItemDTO(
                    item.user(),
                    item.status(),
                    item.invited(),
                    item.direction(),
                    presence
            );
        }).toList();

        return ResponseEntity.ok(enriched);
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
