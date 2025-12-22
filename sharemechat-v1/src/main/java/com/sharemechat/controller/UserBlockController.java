package com.sharemechat.controller;

import com.sharemechat.dto.UserBlockDTO;
import com.sharemechat.entity.User;
import com.sharemechat.service.UserBlockService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/blocks")
public class UserBlockController {

    private final UserBlockService userBlockService;

    public UserBlockController(UserBlockService userBlockService) {
        this.userBlockService = userBlockService;
    }

    // Crear/actualizar bloqueo (idempotente)
    @PostMapping("/{blockedUserId}")
    public ResponseEntity<UserBlockDTO> block(
            @PathVariable Long blockedUserId,
            @RequestBody(required = false) UserBlockDTO body
    ) {
        return ResponseEntity.ok(userBlockService.blockUser(blockedUserId, body));
    }

    // Eliminar bloqueo (idempotente)
    @DeleteMapping("/{blockedUserId}")
    public ResponseEntity<Void> unblock(@PathVariable Long blockedUserId) {
        userBlockService.unblockUser(blockedUserId);
        return ResponseEntity.noContent().build();
    }

    // Listar mis bloqueos
    @GetMapping
    public ResponseEntity<List<UserBlockDTO>> listMyBlocks() {
        return ResponseEntity.ok(userBlockService.listMyBlocks());
    }

    // Batch: mapa id -> true/false (para UI: favoritos "Bloqueado")
    @GetMapping("/map")
    public ResponseEntity<Map<Long, Boolean>> blockedMap(@RequestParam(name = "ids") String ids) {
        List<Long> requested = parseIds(ids);
        if (requested.isEmpty()) return ResponseEntity.ok(Collections.emptyMap());

        Set<Long> blocked = userBlockService.findBlockedIdsByMe(requested);

        Map<Long, Boolean> out = new LinkedHashMap<>();
        for (Long id : requested) out.put(id, blocked.contains(id));
        return ResponseEntity.ok(out);
    }

    // Comprobación útil para UI / debugging
    @GetMapping("/between/{otherUserId}")
    public ResponseEntity<Map<String, Object>> isBlockedBetween(@PathVariable Long otherUserId) {
        User me = userBlockService.getCurrentUserOrThrow();
        boolean blocked = userBlockService.isBlockedBetween(me.getId(), otherUserId);
        return ResponseEntity.ok(Map.of(
                "me", me.getId(),
                "other", otherUserId,
                "blockedBetween", blocked
        ));
    }

    // Endpoint GET /api/blocks/incoming: lista bloqueos entrantes (quién me bloqueó)
    @GetMapping("/incoming")
    public ResponseEntity<List<UserBlockDTO>> listIncomingBlocks() {
        return ResponseEntity.ok(userBlockService.listIncomingBlocks());
    }


    @GetMapping("/incoming/map")
    public ResponseEntity<Map<Long, Boolean>> incomingBlockedMap(@RequestParam(name = "ids") String ids) {
        List<Long> requested = parseIds(ids);
        if (requested.isEmpty()) return ResponseEntity.ok(Collections.emptyMap());

        Set<Long> blockers = userBlockService.findBlockerIdsWhoBlockedMe(requested);

        Map<Long, Boolean> out = new LinkedHashMap<>();
        for (Long id : requested) out.put(id, blockers.contains(id));
        return ResponseEntity.ok(out);
    }

    private static List<Long> parseIds(String raw) {
        if (raw == null || raw.trim().isEmpty()) return Collections.emptyList();
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> {
                    try { return Long.parseLong(s); } catch (Exception e) { return null; }
                })
                .filter(Objects::nonNull)
                .filter(v -> v > 0)
                .distinct()
                .collect(Collectors.toList());
    }
}
