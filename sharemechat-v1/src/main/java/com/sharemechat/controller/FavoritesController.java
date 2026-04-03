package com.sharemechat.controller;

import com.sharemechat.dto.FavoriteListItemDTO;
import com.sharemechat.entity.User;
import com.sharemechat.handler.MessagesWsHandler;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.ConsentEnforcementService;
import com.sharemechat.service.FavoriteService;
import com.sharemechat.service.StatusService;
import com.sharemechat.service.StreamService;
import com.sharemechat.service.UserBlockService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.text.Collator;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@RestController
@RequestMapping("/api/favorites")
public class FavoritesController {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(FavoritesController.class);

    private final FavoriteService favoriteService;
    private final UserRepository userRepository;
    private final MessagesWsHandler messagesWsHandler;
    private final StatusService statusService;
    private final StreamService streamService;
    private final UserBlockService userBlockService;
    private final ConsentEnforcementService consentEnforcementService;

    public FavoritesController(FavoriteService favoriteService,
                               UserRepository userRepository,
                               MessagesWsHandler messagesWsHandler,
                               StatusService statusService,
                               StreamService streamService,
                               UserBlockService userBlockService,
                               ConsentEnforcementService consentEnforcementService) {
        this.favoriteService = favoriteService;
        this.userRepository = userRepository;
        this.messagesWsHandler = messagesWsHandler;
        this.statusService = statusService;
        this.streamService = streamService;
        this.userBlockService = userBlockService;
        this.consentEnforcementService = consentEnforcementService;
    }

    // ===== CLIENT -> MODELS =====
    @PostMapping("/models/{modelId}")
    public ResponseEntity<Void> addModel(Authentication auth, @PathVariable Long modelId) {
        consentEnforcementService.assertAuthenticatedUserCompliant(auth, "POST /api/favorites/models/{modelId}");
        Long clientId = currentUserId(auth);
        favoriteService.addModelToClientFavorites(clientId, modelId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/models/{modelId}")
    public ResponseEntity<Void> removeModel(Authentication auth, @PathVariable Long modelId) {
        consentEnforcementService.assertAuthenticatedUserCompliant(auth, "DELETE /api/favorites/models/{modelId}");
        Long clientId = currentUserId(auth);
        favoriteService.removeModelFromClientFavorites(clientId, modelId);
        return ResponseEntity.noContent().build();
    }

    // ===== MODEL -> CLIENTS =====
    @PostMapping("/clients/{clientId}")
    public ResponseEntity<Void> addClient(Authentication auth, @PathVariable Long clientId) {
        consentEnforcementService.assertAuthenticatedUserCompliant(auth, "POST /api/favorites/clients/{clientId}");
        Long modelId = currentUserId(auth);
        favoriteService.addClientToModelFavorites(modelId, clientId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/clients/{clientId}")
    public ResponseEntity<Void> removeClient(Authentication auth, @PathVariable Long clientId) {
        consentEnforcementService.assertAuthenticatedUserCompliant(auth, "DELETE /api/favorites/clients/{clientId}");
        Long modelId = currentUserId(auth);
        favoriteService.removeClientFromModelFavorites(modelId, clientId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/models/meta")
    public ResponseEntity<List<FavoriteListItemDTO>> listModelsMeta(Authentication auth) {
        consentEnforcementService.assertAuthenticatedUserCompliant(auth, "GET /api/favorites/models/meta");
        Long clientId = currentUserId(auth);

        List<FavoriteListItemDTO> base = favoriteService.listClientFavoritesMeta(clientId);

        List<Long> peerIds = base.stream()
                .map(item -> item.user() != null ? item.user().getId() : null)
                .filter(id -> id != null && id > 0)
                .distinct()
                .toList();

        Set<Long> blockedByMe = userBlockService.findBlockedIdsByMe(peerIds);
        Set<Long> blockedMe = userBlockService.findBlockerIdsWhoBlockedMe(peerIds);

        List<FavoriteListItemDTO> enriched = base.stream()
                .map(item -> {
                    Long modelUserId = (item.user() != null) ? item.user().getId() : null;

                    String presence = "offline";

                    if (modelUserId != null) {
                        String s = statusService.getStatus(modelUserId); // "AVAILABLE", "BUSY" o null
                        if ("BUSY".equals(s)) {
                            presence = "busy";
                        } else if ("AVAILABLE".equals(s)) {
                            presence = "online";
                        } else {
                            boolean online = messagesWsHandler.isUserOnline(modelUserId);
                            presence = online ? "online" : "offline";
                        }
                    }

                    boolean blocked = modelUserId != null
                            && (blockedByMe.contains(modelUserId) || blockedMe.contains(modelUserId));

                    return new FavoriteListItemDTO(
                            item.user(),
                            item.status(),
                            item.invited(),
                            item.direction(),
                            presence,
                            blocked
                    );
                })
                .sorted(favoritesComparator())
                .toList();

        return ResponseEntity.ok(enriched);
    }

    @GetMapping("/clients/meta")
    public ResponseEntity<List<FavoriteListItemDTO>> listClientsMeta(Authentication auth) {
        consentEnforcementService.assertAuthenticatedUserCompliant(auth, "GET /api/favorites/clients/meta");
        Long modelId = currentUserId(auth);

        List<FavoriteListItemDTO> base = favoriteService.listModelFavoritesMeta(modelId);

        List<Long> peerIds = base.stream()
                .map(item -> item.user() != null ? item.user().getId() : null)
                .filter(id -> id != null && id > 0)
                .distinct()
                .toList();

        Set<Long> blockedByMe = userBlockService.findBlockedIdsByMe(peerIds);
        Set<Long> blockedMe = userBlockService.findBlockerIdsWhoBlockedMe(peerIds);

        List<FavoriteListItemDTO> enriched = base.stream()
                .map(item -> {
                    Long clientUserId = (item.user() != null) ? item.user().getId() : null;

                    String presence = "offline";

                    if (clientUserId != null) {
                        try {
                            if (streamService.isUserInActiveStream(clientUserId)) {
                                presence = "busy";
                            } else {
                                boolean online = messagesWsHandler.isUserOnline(clientUserId);
                                presence = online ? "online" : "offline";
                            }
                        } catch (Exception e) {
                            boolean online = messagesWsHandler.isUserOnline(clientUserId);
                            presence = online ? "online" : "offline";
                        }
                    }

                    boolean blocked = clientUserId != null
                            && (blockedByMe.contains(clientUserId) || blockedMe.contains(clientUserId));

                    return new FavoriteListItemDTO(
                            item.user(),
                            item.status(),
                            item.invited(),
                            item.direction(),
                            presence,
                            blocked
                    );
                })
                .sorted(favoritesComparator())
                .toList();

        return ResponseEntity.ok(enriched);
    }

    // ===== Aceptar / Rechazar invitación =====
    @PostMapping("/accept/{peerId}")
    public ResponseEntity<Void> accept(Authentication auth, @PathVariable Long peerId) {
        consentEnforcementService.assertAuthenticatedUserCompliant(auth, "POST /api/favorites/accept/{peerId}");
        favoriteService.acceptInvitation(currentUserId(auth), peerId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/reject/{peerId}")
    public ResponseEntity<Void> reject(Authentication auth, @PathVariable Long peerId) {
        consentEnforcementService.assertAuthenticatedUserCompliant(auth, "POST /api/favorites/reject/{peerId}");
        favoriteService.rejectInvitation(currentUserId(auth), peerId);
        return ResponseEntity.noContent().build();
    }

    private Long currentUserId(Authentication auth) {
        String email = auth.getName();
        User u = userRepository.findByEmail(email).orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        return u.getId();
    }

    private Comparator<FavoriteListItemDTO> favoritesComparator() {
        Collator collator = Collator.getInstance(new Locale("es", "ES"));
        collator.setStrength(Collator.PRIMARY);

        return Comparator
                .comparingInt(this::blockedRank)
                .thenComparingInt(this::connectionRank)
                .thenComparing(this::safeNickname, collator);
    }

    private int blockedRank(FavoriteListItemDTO item) {
        return item != null && item.blocked() ? 1 : 0;
    }

    private int connectionRank(FavoriteListItemDTO item) {
        if (item != null && item.blocked()) {
            return 2;
        }

        String presence = item != null ? item.presence() : null;

        if ("online".equalsIgnoreCase(presence) || "busy".equalsIgnoreCase(presence)) {
            return 0;
        }

        return 1; // offline o null
    }

    private String safeNickname(FavoriteListItemDTO item) {
        if (item == null || item.user() == null || item.user().getNickname() == null) {
            return "";
        }
        return item.user().getNickname().trim();
    }
}
