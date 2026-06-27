package com.sharemechat.streammoderation.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.streammoderation.dto.ModerationFrameSubmission;
import com.sharemechat.streammoderation.dto.ModerationVerdictResult;
import com.sharemechat.streammoderation.entity.StreamModerationSession;
import com.sharemechat.streammoderation.repository.StreamModerationReviewRepository;
import com.sharemechat.streammoderation.repository.StreamModerationSessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

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

    public StreamFrameIngestionService(
            StreamModerationSessionRepository sessionRepository,
            StreamModerationSessionService sessionService,
            StreamModerationActionService actionService,
            StreamModerationReviewRepository reviewRepository,
            ModerationEvidenceUploader evidenceUploader) {
        this.sessionRepository = sessionRepository;
        this.sessionService = sessionService;
        this.actionService = actionService;
        this.reviewRepository = reviewRepository;
        this.evidenceUploader = evidenceUploader;
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

        actionService.applyVerdict(session, verdict);

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
}
