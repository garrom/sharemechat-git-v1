package com.sharemechat.streammoderation.service;

import com.sharemechat.config.PresenceCheckProperties;
import com.sharemechat.constants.Constants;
import com.sharemechat.streammoderation.dto.ModerationCategoryVerdict;
import com.sharemechat.streammoderation.dto.ModerationFrameSubmission;
import com.sharemechat.streammoderation.dto.ModerationVerdictResult;
import com.sharemechat.streammoderation.dto.PresenceCheckResult;
import com.sharemechat.streammoderation.entity.StreamModerationSession;
import com.sharemechat.streammoderation.repository.StreamModerationReviewRepository;
import com.sharemechat.streammoderation.repository.StreamModerationSessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Optional;

/**
 * Orquestador del frame ingest del frente Moderacion IA P2.1.
 *
 * <p>Recibe el frame ya validado por {@code StreamFrameController}
 * (rol MODEL, ownership, MIME, magic bytes, tamano), lo despacha al
 * adapter del vendor activo via {@link StreamModerationSessionService},
 * y delega la accion sobre el verdict a
 * {@link StreamModerationActionService}.
 *
 * <p>Politica fail-closed-soft (DEC-11; ADR-036 bloque 3): si el
 * adapter lanza excepcion (creds blank, 4xx, 5xx, timeout), marca la
 * sesion como DEGRADED. El scheduler
 * {@code StreamModerationDegradationJob} la cortara tras N minutos.
 *
 * <p>Politica de evidencia (DEC-3): si severity &ge; AMBER, dispara el
 * upload async al bucket S3 dedicado.
 */
@Service
public class StreamFrameIngestionService {

    private static final Logger log = LoggerFactory.getLogger(StreamFrameIngestionService.class);

    private final StreamModerationSessionRepository sessionRepository;
    private final StreamModerationSessionService sessionService;
    private final StreamModerationActionService actionService;
    private final StreamModerationReviewRepository reviewRepository;
    private final ModerationEvidenceUploader evidenceUploader;
    // ADR-050 Fase C: hook opcional de presencia continua. Solo se
    // invoca si presenceProps.enabled=true y el adapter activo lo soporta.
    private final PresenceCheckProperties presenceProps;

    public StreamFrameIngestionService(
            StreamModerationSessionRepository sessionRepository,
            StreamModerationSessionService sessionService,
            StreamModerationActionService actionService,
            StreamModerationReviewRepository reviewRepository,
            ModerationEvidenceUploader evidenceUploader,
            PresenceCheckProperties presenceProps) {
        this.sessionRepository = sessionRepository;
        this.sessionService = sessionService;
        this.actionService = actionService;
        this.reviewRepository = reviewRepository;
        this.evidenceUploader = evidenceUploader;
        this.presenceProps = presenceProps;
    }

    /**
     * Procesa un frame asincronicamente en el {@code moderationExecutor}.
     * El controller responde 202 inmediato y este metodo corre fuera
     * del thread del request HTTP.
     */
    @Async("moderationExecutor")
    public void processFrame(Long streamModerationSessionId,
                             byte[] frameBytes,
                             Instant frameTimestamp) {
        try {
            processFrameSync(streamModerationSessionId, frameBytes, frameTimestamp);
        } catch (Exception ex) {
            // Cualquier excepcion no manejada queda atrapada para no romper el pool.
            log.error("[STREAM-MOD] processFrame FAIL sessionId={}: {}",
                    streamModerationSessionId, ex.getMessage(), ex);
        }
    }

    // Lo expongo package-private para tests sincronos sin @Async.
    void processFrameSync(Long streamModerationSessionId,
                          byte[] frameBytes,
                          Instant frameTimestamp) {
        Optional<StreamModerationSession> opt = sessionRepository.findById(streamModerationSessionId);
        if (opt.isEmpty()) {
            log.warn("[STREAM-MOD] processFrame sin sesion sessionId={}", streamModerationSessionId);
            return;
        }
        StreamModerationSession session = opt.get();
        String status = session.getStatus();
        if (!Constants.StreamModerationSessionStatus.ACTIVE.equals(status)
                && !Constants.StreamModerationSessionStatus.DEGRADED.equals(status)) {
            log.info("[STREAM-MOD] processFrame skip status={} sessionId={}", status, session.getId());
            return;
        }

        ModerationProviderClient client = sessionService.resolveActiveClient();

        ModerationFrameSubmission submission = new ModerationFrameSubmission();
        submission.setFrameBytes(frameBytes);
        submission.setStreamRecordId(session.getStreamRecordId());
        submission.setStreamModerationSessionId(session.getId());
        submission.setFrameTimestamp(frameTimestamp);

        ModerationVerdictResult verdict;
        try {
            verdict = client.submitImage(submission);
        } catch (Exception ex) {
            log.warn("[STREAM-MOD] adapter error sessionId={} provider={}: {}",
                    session.getId(), session.getProvider(), ex.getMessage());
            sessionService.markDegraded(session.getId());
            return;
        }

        // ADR-050 Fase C: check de presencia. Fail-soft: si la llamada
        // falla, no marca la sesion como DEGRADED (moderacion de
        // contenido sigue vigente y su fallo si marcaria degraded).
        // Solo se dispara si presence.enabled=true.
        PresenceCheckResult pres = null;
        if (presenceProps != null && presenceProps.isEnabled()) {
            try {
                pres = client.checkPresence(frameBytes);
                if (pres != null) {
                    fusePresenceIntoVerdict(verdict, pres);
                }
            } catch (Exception ex) {
                log.warn("[STREAM-MOD-PRESENCE] check error sessionId={} provider={}: {}",
                        session.getId(), session.getProvider(), ex.getMessage());
            }

            // ADR-050 Fase D: detección de frame congelado via hash. Se
            // ejecuta solo si presence.enabled=true (mismo kill-switch
            // que Fase C ya que es defensa complementaria). Coste cero.
            try {
                fuseFrozenFrameIntoVerdict(session, verdict, frameBytes);
            } catch (Exception ex) {
                log.warn("[STREAM-MOD-FROZEN] check error sessionId={}: {}",
                        session.getId(), ex.getMessage());
            }

            // ADR-050 Fase E (#D-33): detección de ausencia sostenida
            // de cara. Solo cuenta si el presence check devolvio result;
            // si SightEngine fallo (pres=null), no toca contador.
            try {
                if (pres != null) {
                    fuseNoFaceIntoVerdict(session, verdict, pres);
                }
            } catch (Exception ex) {
                log.warn("[STREAM-MOD-NOFACE] check error sessionId={}: {}",
                        session.getId(), ex.getMessage());
            }
        }

        actionService.applyVerdict(session, verdict);

        // (severity ya puede haber sido elevada por presencia)
        String severity = verdict.getSeverityOverall();
        if (Constants.StreamModerationSeverity.AMBER.equals(severity)
                || Constants.StreamModerationSeverity.RED.equals(severity)
                || Constants.StreamModerationSeverity.CRITICAL.equals(severity)) {
            String pev = verdict.getProviderEventId();
            if (pev != null && !pev.isBlank()) {
                reviewRepository.findByProviderAndProviderEventId(session.getProvider(), pev)
                        .ifPresent(r -> evidenceUploader.uploadAsync(r.getId(), frameBytes));
            }
        }
    }

    /**
     * ADR-050 Fase C: fusiona el resultado de presencia con el verdict
     * de contenido. Si {@code outOfScene >= umbralCritical}, anade una
     * categoria OUT_OF_SCENE con severidad CRITICAL al verdict y eleva
     * la severidad global si es menor.
     *
     * <p>Package-private para test.
     */
    void fusePresenceIntoVerdict(ModerationVerdictResult verdict, PresenceCheckResult pres) {
        if (verdict == null || pres == null) return;

        double threshold = presenceProps.getOutOfSceneCritical();
        double outOfScene = pres.getOutOfScene();

        // Si no hay cara detectada o el score no supera el umbral, no
        // se toca el verdict (interpretacion neutra: la moderacion de
        // contenido decide sola).
        if (!pres.isFaceDetected() || outOfScene < threshold) {
            return;
        }

        // Anadir categoria OUT_OF_SCENE con severidad CRITICAL.
        ModerationCategoryVerdict cat = new ModerationCategoryVerdict(
                Constants.StreamModerationCategory.OUT_OF_SCENE,
                java.math.BigDecimal.valueOf(outOfScene),
                Constants.StreamModerationSeverity.CRITICAL);
        if (verdict.getCategoryVerdicts() != null) {
            verdict.getCategoryVerdicts().put(
                    Constants.StreamModerationCategory.OUT_OF_SCENE, cat);
        }

        // Elevar severidad global si la actual es menor que CRITICAL.
        String current = verdict.getSeverityOverall();
        if (!Constants.StreamModerationSeverity.CRITICAL.equals(current)) {
            verdict.setSeverityOverall(Constants.StreamModerationSeverity.CRITICAL);
        }

        log.warn("[STREAM-MOD-PRESENCE] OUT_OF_SCENE detected outOfScene={} overlay={} threshold={}",
                String.format("%.2f", outOfScene),
                String.format("%.2f", pres.getOutOfSceneOverlay()),
                threshold);
    }

    /**
     * ADR-050 Fase D: detecta stream congelado comparando el hash SHA-256
     * del frame entrante con el ultimo guardado en la sesion.
     *
     * <p>Comportamiento:
     * <ul>
     *   <li>Frame distinto al anterior: resetea contador a 0, actualiza
     *       {@code lastFrameSha256}. Persiste.</li>
     *   <li>Frame identico: incrementa contador. Persiste. Si supera
     *       {@code frozen-max-consecutive}, anade categoria FROZEN_STREAM
     *       con severity CRITICAL al verdict y eleva severidad global
     *       (mismo path que OUT_OF_SCENE → auto-cut).</li>
     * </ul>
     *
     * <p>Fail-soft: cualquier error se loguea y no afecta al verdict de
     * contenido. Cero llamadas al vendor.
     */
    void fuseFrozenFrameIntoVerdict(StreamModerationSession session,
                                     ModerationVerdictResult verdict,
                                     byte[] frameBytes) {
        if (session == null || verdict == null || frameBytes == null || frameBytes.length == 0) return;

        String hash = sha256Hex(frameBytes);
        if (hash == null) return;

        String prev = session.getLastFrameSha256();
        int counter = session.getConsecutiveIdenticalFrames();

        if (prev != null && prev.equals(hash)) {
            counter += 1;
        } else {
            counter = 0;
        }

        session.setLastFrameSha256(hash);
        session.setConsecutiveIdenticalFrames(counter);
        sessionRepository.save(session);

        int threshold = presenceProps.getFrozenMaxConsecutive();
        if (counter < threshold) return;

        ModerationCategoryVerdict cat = new ModerationCategoryVerdict(
                Constants.StreamModerationCategory.FROZEN_STREAM,
                java.math.BigDecimal.valueOf(counter),
                Constants.StreamModerationSeverity.CRITICAL);
        if (verdict.getCategoryVerdicts() != null) {
            verdict.getCategoryVerdicts().put(
                    Constants.StreamModerationCategory.FROZEN_STREAM, cat);
        }

        String current = verdict.getSeverityOverall();
        if (!Constants.StreamModerationSeverity.CRITICAL.equals(current)) {
            verdict.setSeverityOverall(Constants.StreamModerationSeverity.CRITICAL);
        }

        log.warn("[STREAM-MOD-FROZEN] FROZEN_STREAM detected sessionId={} consecutive={} threshold={} hash={}",
                session.getId(), counter, threshold, hash.substring(0, 8));
    }

    /**
     * ADR-050 Fase E (#D-33): detecta ausencia sostenida de cara. Si
     * {@code faceDetected=false}, incrementa contador; si detecta cara
     * lo resetea. Al superar {@code no-face-max-consecutive} anade
     * categoria NO_FACE_SUSTAINED CRITICAL y eleva severidad global.
     *
     * <p>Cubre el hueco donde Fase C (OUT_OF_SCENE) no dispara porque
     * no hay cara para evaluar, y Fase D (FROZEN_STREAM) no dispara
     * porque el ruido natural varia los frames aunque no haya sujeto.
     *
     * <p>Package-private para test.
     */
    void fuseNoFaceIntoVerdict(StreamModerationSession session,
                                ModerationVerdictResult verdict,
                                PresenceCheckResult pres) {
        if (session == null || verdict == null || pres == null) return;

        int counter = session.getConsecutiveNoFaceFrames();
        if (pres.isFaceDetected()) {
            counter = 0;
        } else {
            counter += 1;
        }
        session.setConsecutiveNoFaceFrames(counter);
        sessionRepository.save(session);

        int threshold = presenceProps.getNoFaceMaxConsecutive();
        if (counter < threshold) return;

        ModerationCategoryVerdict cat = new ModerationCategoryVerdict(
                Constants.StreamModerationCategory.NO_FACE_SUSTAINED,
                java.math.BigDecimal.valueOf(counter),
                Constants.StreamModerationSeverity.CRITICAL);
        if (verdict.getCategoryVerdicts() != null) {
            verdict.getCategoryVerdicts().put(
                    Constants.StreamModerationCategory.NO_FACE_SUSTAINED, cat);
        }

        String current = verdict.getSeverityOverall();
        if (!Constants.StreamModerationSeverity.CRITICAL.equals(current)) {
            verdict.setSeverityOverall(Constants.StreamModerationSeverity.CRITICAL);
        }

        log.warn("[STREAM-MOD-NOFACE] NO_FACE_SUSTAINED detected sessionId={} consecutive={} threshold={}",
                session.getId(), counter, threshold);
    }

    /**
     * Hash SHA-256 hex del contenido del frame. Devuelve null si el
     * algoritmo no esta disponible (imposible en JVM estandar).
     */
    static String sha256Hex(byte[] data) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(data);
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException ex) {
            return null;
        }
    }
}
