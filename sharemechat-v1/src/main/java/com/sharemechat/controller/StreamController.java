package com.sharemechat.controller;

import com.sharemechat.service.ConsentEnforcementService;
import com.sharemechat.service.StreamService;
import com.sharemechat.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/streams")
public class StreamController {

    private final StreamService streamService;
    private final ConsentEnforcementService consentEnforcementService;
    private final UserService userService;

    public StreamController(StreamService streamService,
                            ConsentEnforcementService consentEnforcementService,
                            UserService userService) {
        this.streamService = streamService;
        this.consentEnforcementService = consentEnforcementService;
        this.userService = userService;
    }

    /**
     * ACK industrial: el frontend llama cuando el WebRTC está realmente conectado
     * (remote track recibido / iceConnectionState connected).
     *
     * Idempotente: si ya estaba confirmada, no hace nada.
     */
    @PostMapping("/{streamRecordId}/ack-media")
    public ResponseEntity<Void> ackMedia(@PathVariable Long streamRecordId,
                                         Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(401).build();
        }

        var user = userService.findByEmail(authentication.getName());
        if (user == null) {
            return ResponseEntity.status(401).build();
        }

        consentEnforcementService.assertUserCompliant(user.getId(), "POST /api/streams/{streamRecordId}/ack-media");
        streamService.ackMedia(streamRecordId, user.getId());

        return ResponseEntity.ok().build();
    }
}
