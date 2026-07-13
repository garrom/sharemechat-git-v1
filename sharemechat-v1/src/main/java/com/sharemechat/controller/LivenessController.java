package com.sharemechat.controller;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.LivenessAttempt;
import com.sharemechat.entity.User;
import com.sharemechat.service.LivenessChallengeService;
import com.sharemechat.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * ADR-050 Fase B: endpoints del liveness challenge.
 *
 * <p>Tres endpoints, todos autenticados:
 * <ul>
 *   <li>{@code GET /api/streaming/liveness/status} — devuelve si el user
 *       tiene un pass vigente. El frontend lo consulta antes de abrir el
 *       modal para decidir si mostrarlo o saltarlo.</li>
 *   <li>{@code POST /api/streaming/liveness/challenge} — inicia un
 *       intento. Idempotente cuando ya hay pass vigente (devuelve el
 *       existente). 429 cuando el user esta en cooldown D6.</li>
 *   <li>{@code POST /api/streaming/liveness/verify} — recibe los frames
 *       JPEG multipart, delega en el service, devuelve el resultado.
 *       Validaciones de frame calcadas de {@code StreamFrameController}
 *       (magic bytes, tamano max 5 MB por frame).</li>
 * </ul>
 *
 * <p>El nombre del vendor (Sightengine) NO aparece en el contrato
 * publico del controller (regla vendor-agnostic en dominio del
 * proyecto).
 */
@RestController
@RequestMapping("/api/streaming/liveness")
public class LivenessController {

    private static final Logger log = LoggerFactory.getLogger(LivenessController.class);

    /** DEC-7 P2.1 replicado: tamano max por frame JPEG. */
    private static final long MAX_FRAME_BYTES = 5L * 1024 * 1024;
    /** Numero maximo de frames aceptados por request (defensa contra flood). */
    private static final int MAX_FRAMES_PER_REQUEST = 8;

    private final LivenessChallengeService service;
    private final UserService userService;

    public LivenessController(LivenessChallengeService service, UserService userService) {
        this.service = service;
        this.userService = userService;
    }

    // =====================================================
    // GET /status
    // =====================================================

    @GetMapping("/status")
    public ResponseEntity<?> status(Authentication auth) {
        User user = requireUser(auth);
        if (user == null) return unauthorized();

        Optional<LivenessAttempt> current = service.hasCurrentPass(user.getId());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("hasCurrentPass", current.isPresent());
        current.ifPresent(la -> {
            body.put("passedUntil", la.getPassedUntil() == null ? null : la.getPassedUntil().toString());
            body.put("challengeType", la.getChallengeType());
        });
        return ResponseEntity.ok(body);
    }

    // =====================================================
    // POST /challenge
    // =====================================================

    @PostMapping("/challenge")
    public ResponseEntity<?> challenge(Authentication auth) {
        User user = requireUser(auth);
        if (user == null) return unauthorized();

        try {
            LivenessAttempt row = service.startChallenge(user.getId());
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("challengeId", row.getId());
            body.put("challengeType", row.getChallengeType());
            body.put("promptLc", row.getPromptLc());
            body.put("status", row.getStatus());
            if (Constants.LivenessChallengeStatus.PASSED.equals(row.getStatus())) {
                body.put("hasCurrentPass", true);
                body.put("passedUntil", row.getPassedUntil() == null ? null : row.getPassedUntil().toString());
            }
            return ResponseEntity.ok(body);
        } catch (IllegalStateException ex) {
            if ("cooldown_active".equals(ex.getMessage())) {
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of(
                        "error", "cooldown_active",
                        "message", "Has superado el numero de intentos permitido. Espera unos minutos e intentalo de nuevo."
                ));
            }
            log.warn("[LIVENESS-CTRL] challenge unexpected state userId={} msg={}",
                    user.getId(), ex.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "error", "internal_error"
            ));
        } catch (Exception ex) {
            log.error("[LIVENESS-CTRL] challenge failed userId={}", user.getId(), ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "error", "internal_error"
            ));
        }
    }

    // =====================================================
    // POST /verify
    // =====================================================

    @PostMapping(value = "/verify", consumes = "multipart/form-data")
    public ResponseEntity<?> verify(@RequestParam("challengeId") Long challengeId,
                                     @RequestPart("frames") List<MultipartFile> frames,
                                     Authentication auth) {
        User user = requireUser(auth);
        if (user == null) return unauthorized();
        if (challengeId == null || challengeId <= 0) {
            return err(HttpStatus.BAD_REQUEST, "invalid_challenge_id");
        }
        if (frames == null || frames.isEmpty()) {
            return err(HttpStatus.BAD_REQUEST, "no_frames");
        }
        if (frames.size() > MAX_FRAMES_PER_REQUEST) {
            return err(HttpStatus.PAYLOAD_TOO_LARGE, "too_many_frames");
        }

        List<byte[]> frameBytes = new ArrayList<>(frames.size());
        for (MultipartFile f : frames) {
            if (f == null || f.isEmpty()) {
                return err(HttpStatus.BAD_REQUEST, "empty_frame");
            }
            if (f.getSize() > MAX_FRAME_BYTES) {
                return err(HttpStatus.PAYLOAD_TOO_LARGE, "frame_too_large");
            }
            byte[] bytes;
            try {
                bytes = f.getBytes();
            } catch (IOException ex) {
                log.warn("[LIVENESS-CTRL] frame read error userId={}: {}", user.getId(), ex.getMessage());
                return err(HttpStatus.BAD_REQUEST, "frame_read_error");
            }
            if (!isValidImage(bytes)) {
                return err(HttpStatus.BAD_REQUEST, "invalid_image");
            }
            frameBytes.add(bytes);
        }

        try {
            LivenessAttempt result = service.verify(user.getId(), challengeId, frameBytes);
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("challengeId", result.getId());
            body.put("status", result.getStatus());
            body.put("passed", Constants.LivenessChallengeStatus.PASSED.equals(result.getStatus()));
            if (result.getPassedUntil() != null) {
                body.put("passedUntil", result.getPassedUntil().toString());
            }
            return ResponseEntity.ok(body);
        } catch (IllegalStateException ex) {
            String msg = ex.getMessage() == null ? "" : ex.getMessage();
            HttpStatus http = HttpStatus.CONFLICT;
            if ("challenge_not_found".equals(msg)) http = HttpStatus.NOT_FOUND;
            else if ("challenge_owner_mismatch".equals(msg)) http = HttpStatus.FORBIDDEN;
            return err(http, msg);
        } catch (Exception ex) {
            log.error("[LIVENESS-CTRL] verify failed userId={} challengeId={}",
                    user.getId(), challengeId, ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "error", "internal_error"
            ));
        }
    }

    // =====================================================
    // Helpers
    // =====================================================

    private User requireUser(Authentication auth) {
        if (auth == null || auth.getName() == null) return null;
        return userService.findByEmail(auth.getName());
    }

    private ResponseEntity<?> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "unauthenticated"));
    }

    private static ResponseEntity<?> err(HttpStatus status, String code) {
        Map<String, String> body = new HashMap<>();
        body.put("error", code);
        return ResponseEntity.status(status).body(body);
    }

    /** Magic bytes JPEG y PNG. Calcado de {@code StreamFrameController.isValidImage}. */
    static boolean isValidImage(byte[] head) {
        if (head == null || head.length < 4) return false;
        if ((head[0] & 0xFF) == 0xFF && (head[1] & 0xFF) == 0xD8 && (head[2] & 0xFF) == 0xFF) {
            return true; // JPEG
        }
        if (head.length >= 8
                && (head[0] & 0xFF) == 0x89 && head[1] == 0x50 && head[2] == 0x4E && head[3] == 0x47
                && head[4] == 0x0D && head[5] == 0x0A && (head[6] & 0xFF) == 0x1A && head[7] == 0x0A) {
            return true; // PNG
        }
        return false;
    }
}
