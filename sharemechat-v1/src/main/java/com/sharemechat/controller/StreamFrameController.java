package com.sharemechat.controller;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.StreamRecord;
import com.sharemechat.entity.User;
import com.sharemechat.repository.StreamRecordRepository;
import com.sharemechat.service.UserService;
import com.sharemechat.streammoderation.entity.StreamModerationSession;
import com.sharemechat.streammoderation.repository.StreamModerationSessionRepository;
import com.sharemechat.streammoderation.service.StreamFrameIngestionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;

/**
 * Endpoint de ingest de frames del frente Moderacion IA P2.1
 * (ADR-036 captura cliente-side; DEC-4 P2.1: respuesta 202 inmediata,
 * proceso asincrono en {@code moderationExecutor}).
 *
 * <p>Solo el modelo del stream puede submitir frames. El control de
 * rol MODEL se hace tambien en {@code SecurityConfig} via matcher
 * sobre {@code POST /api/streams/&#42;/frames}; este controller refuerza
 * con ownership check explicito ({@code stream.modelId == auth.userId}).
 *
 * <p>Validaciones secuenciales:
 * <ol>
 *   <li>frame vacio &rArr; 400 {@code empty_frame}</li>
 *   <li>tamano &gt; 5 MB &rArr; 413 {@code frame_too_large}</li>
 *   <li>MIME / magic bytes invalido &rArr; 400 {@code invalid_image}</li>
 *   <li>stream no existe &rArr; 404 {@code stream_not_found}</li>
 *   <li>auth.user != stream.model &rArr; 403 {@code not_stream_model}</li>
 *   <li>sesion moderacion no ACTIVE/DEGRADED &rArr; 409
 *       {@code moderation_session_not_active}</li>
 * </ol>
 *
 * <p>Sin todos los checks OK, incrementa
 * {@code session.framesSubmitted} sincrono (visibilidad inmediata en
 * panel admin) y dispara
 * {@link StreamFrameIngestionService#processFrame} async.
 */
@RestController
public class StreamFrameController {

    private static final Logger log = LoggerFactory.getLogger(StreamFrameController.class);

    private static final long MAX_FRAME_BYTES = 5L * 1024 * 1024; // 5 MB (DEC-7)

    private final UserService userService;
    private final StreamRecordRepository streamRecordRepository;
    private final StreamModerationSessionRepository sessionRepository;
    private final StreamFrameIngestionService ingestionService;

    // Default explicito en la declaracion para que MockMvc standaloneSetup
    // (que no resuelve @Value) tenga un cap real desde el constructor.
    @Value("${moderation.frame.max-bytes:5242880}")
    private long maxFrameBytes = MAX_FRAME_BYTES;

    public StreamFrameController(UserService userService,
                                 StreamRecordRepository streamRecordRepository,
                                 StreamModerationSessionRepository sessionRepository,
                                 StreamFrameIngestionService ingestionService) {
        this.userService = userService;
        this.streamRecordRepository = streamRecordRepository;
        this.sessionRepository = sessionRepository;
        this.ingestionService = ingestionService;
    }

    @PostMapping(value = "/api/streams/{streamId}/frames",
                 consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> submitFrame(
            Authentication authentication,
            @PathVariable Long streamId,
            @RequestPart("frame") MultipartFile frame) {

        User user = requireUser(authentication);
        if (user == null) return err(HttpStatus.UNAUTHORIZED, "unauthenticated");
        if (!Constants.Roles.MODEL.equals(user.getRole())) {
            return err(HttpStatus.FORBIDDEN, "not_model_role");
        }

        if (frame == null || frame.isEmpty() || frame.getSize() == 0) {
            return err(HttpStatus.BAD_REQUEST, "empty_frame");
        }
        if (frame.getSize() > maxFrameBytes) {
            return err(HttpStatus.PAYLOAD_TOO_LARGE, "frame_too_large");
        }

        String mime = frame.getContentType();
        if (mime != null
                && !MediaType.IMAGE_JPEG_VALUE.equalsIgnoreCase(mime)
                && !MediaType.IMAGE_PNG_VALUE.equalsIgnoreCase(mime)) {
            return err(HttpStatus.BAD_REQUEST, "unsupported_mime");
        }

        byte[] bytes;
        try {
            bytes = frame.getBytes();
        } catch (IOException ex) {
            return err(HttpStatus.BAD_REQUEST, "read_failed");
        }
        if (!isValidImage(bytes)) {
            return err(HttpStatus.BAD_REQUEST, "invalid_image");
        }

        Optional<StreamRecord> recOpt = streamRecordRepository.findById(streamId);
        if (recOpt.isEmpty()) {
            return err(HttpStatus.NOT_FOUND, "stream_not_found");
        }
        StreamRecord stream = recOpt.get();
        Long modelId = stream.getModel() != null ? stream.getModel().getId() : null;
        if (modelId == null || !modelId.equals(user.getId())) {
            return err(HttpStatus.FORBIDDEN, "not_stream_model");
        }

        Optional<StreamModerationSession> sessOpt = sessionRepository.findByStreamRecordId(streamId);
        if (sessOpt.isEmpty()) {
            return err(HttpStatus.CONFLICT, "moderation_session_not_active");
        }
        StreamModerationSession session = sessOpt.get();
        String status = session.getStatus();
        if (!Constants.StreamModerationSessionStatus.ACTIVE.equals(status)
                && !Constants.StreamModerationSessionStatus.DEGRADED.equals(status)) {
            return err(HttpStatus.CONFLICT, "moderation_session_not_active");
        }

        // Visibilidad inmediata en panel admin: incrementar contador sincrono.
        session.setFramesSubmitted(session.getFramesSubmitted() + 1);
        sessionRepository.save(session);

        ingestionService.processFrame(session.getId(), bytes, Instant.now());

        log.info("[STREAM-MOD] frame queued streamId={} sessionId={} sizeBytes={}",
                streamId, session.getId(), bytes.length);

        return ResponseEntity.accepted().body(Map.of("status", "queued"));
    }

    private User requireUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) return null;
        return userService.findByEmail(authentication.getName());
    }

    private static ResponseEntity<?> err(HttpStatus status, String code) {
        return ResponseEntity.status(status).body(Map.of("error", code));
    }

    /**
     * Magic bytes para JPEG (FFD8FF) y PNG (89 50 4E 47 0D 0A 1A 0A).
     * Cualquier otro contenido (incluso con MIME image/jpeg falso) se
     * rechaza.
     */
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
