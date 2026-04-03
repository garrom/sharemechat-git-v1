package com.sharemechat.controller;

import com.sharemechat.security.JwtUtil;
import com.sharemechat.service.ConsentEnforcementService;
import com.sharemechat.service.StreamService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/streams")
public class StreamController {

    private final StreamService streamService;
    private final JwtUtil jwtUtil;
    private final ConsentEnforcementService consentEnforcementService;

    public StreamController(StreamService streamService, JwtUtil jwtUtil, ConsentEnforcementService consentEnforcementService) {
        this.streamService = streamService;
        this.jwtUtil = jwtUtil;
        this.consentEnforcementService = consentEnforcementService;
    }

    /**
     * ACK industrial: el frontend llama cuando el WebRTC está realmente conectado
     * (remote track recibido / iceConnectionState connected).
     *
     * Idempotente: si ya estaba confirmada, no hace nada.
     */
    @PostMapping("/{streamRecordId}/ack-media")
    public ResponseEntity<Void> ackMedia(@PathVariable Long streamRecordId,
                                         HttpServletRequest request) {

        String auth = request.getHeader("Authorization");
        if (auth == null || !auth.startsWith("Bearer ")) {
            return ResponseEntity.status(401).build();
        }

        String token = auth.substring(7);
        if (!jwtUtil.isTokenValid(token)) {
            return ResponseEntity.status(401).build();
        }

        Long userId = jwtUtil.extractUserId(token);
        consentEnforcementService.assertUserCompliant(userId, "POST /api/streams/{streamRecordId}/ack-media");
        streamService.ackMedia(streamRecordId, userId);

        return ResponseEntity.ok().build();
    }
}
