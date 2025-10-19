package com.sharemechat.controller;

import com.sharemechat.dto.FavoriteListItemDTO;
import com.sharemechat.dto.UserSummaryDTO;
import com.sharemechat.entity.User;
import com.sharemechat.handler.MessagesWsHandler;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.FavoriteService;
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

    public FavoritesController(FavoriteService favoriteService,
                               UserRepository userRepository,
                               MessagesWsHandler messagesWsHandler) {
        this.favoriteService = favoriteService;
        this.userRepository = userRepository;
        this.messagesWsHandler = messagesWsHandler;
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

        log.info("[Fav:models] clientId={} items={}", clientId, (base != null ? base.size() : 0));

        // 2) Enriquecemos con presence usando SIEMPRE el userId de la MODELO
        List<FavoriteListItemDTO> enriched = base.stream().map(item -> {
            // OJO: item.user() debe ser el "usuario" de la MODELO (no el del cliente)
            Long modelUserId = (item.user() != null) ? item.user().getId() : null;

            String presence = "offline";
            boolean online = false;
            boolean busy = false;

            if (modelUserId != null) {
                busy = messagesWsHandler.isBusy(modelUserId);
                online = messagesWsHandler.isUserOnline(modelUserId);
                presence = busy ? "busy" : (online ? "online" : "offline");
            }

            // Logs finos para cada ítem
            log.info("[Fav:models] peer(modelUserId)={} nick={} status={} invited={} -> presence={} (busy={}, online={})",
                    modelUserId,
                    (item.user() != null ? item.user().getNickname() : null),
                    item.status(),
                    item.invited(),
                    presence,
                    busy,
                    online
            );

            return new FavoriteListItemDTO(
                    item.user(),       // <-- el UserSummaryDTO de la MODELO
                    item.status(),
                    item.invited(),
                    item.direction(),
                    presence            // <-- presencia final
            );
        }).toList();

        return ResponseEntity.ok(enriched);
    }


    @GetMapping("/clients/meta")
    public ResponseEntity<List<FavoriteListItemDTO>> listClientsMeta(Authentication auth) {
        Long modelId = currentUserId(auth);

        List<FavoriteListItemDTO> base = favoriteService.listModelFavoritesMeta(modelId);

        log.info("[Fav:clients] modelId={} items={}", modelId, (base != null ? base.size() : 0));

        List<FavoriteListItemDTO> enriched = base.stream().map(item -> {
            Long clientUserId = (item.user() != null) ? item.user().getId() : null;

            String presence = "offline";
            boolean online = false;
            boolean busy = false;

            if (clientUserId != null) {
                busy = messagesWsHandler.isBusy(clientUserId);
                online = messagesWsHandler.isUserOnline(clientUserId);
                presence = busy ? "busy" : (online ? "online" : "offline");
            }

            log.info("[Fav:clients] peer(clientUserId)={} nick={} status={} invited={} -> presence={} (busy={}, online={})",
                    clientUserId,
                    (item.user() != null ? item.user().getNickname() : null),
                    item.status(),
                    item.invited(),
                    presence,
                    busy,
                    online
            );

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
