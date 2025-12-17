package com.sharemechat.controller;

import com.sharemechat.dto.UserBlockDTO;
import com.sharemechat.entity.User;
import com.sharemechat.service.UserBlockService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

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
}
