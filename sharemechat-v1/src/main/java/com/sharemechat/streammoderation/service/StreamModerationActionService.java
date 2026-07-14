package com.sharemechat.streammoderation.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.StreamRecord;
import com.sharemechat.handler.MatchingHandler;
import com.sharemechat.handler.MessagesWsHandler;
import com.sharemechat.service.StreamService;
import com.sharemechat.streammoderation.dto.ModerationCategoryVerdict;
import com.sharemechat.streammoderation.dto.ModerationVerdictResult;
import com.sharemechat.streammoderation.entity.StreamModerationEvent;
import com.sharemechat.streammoderation.entity.StreamModerationReview;
import com.sharemechat.streammoderation.entity.StreamModerationSession;
import com.sharemechat.streammoderation.repository.StreamModerationEventRepository;
import com.sharemechat.streammoderation.repository.StreamModerationReviewRepository;
import com.sharemechat.streammoderation.repository.StreamModerationSessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Optional;
import java.util.UUID;

/**
 * Servicio que materializa la tabla de decision del frente Moderacion
 * IA (ADR-030 / ADR-036) sobre un verdict normalizado del adapter.
 *
 * <p>Tabla de decision por {@code severityOverall}:
 * <ul>
 *   <li>GREEN: persiste evento + incrementa contador, no-op adicional.</li>
 *   <li>AMBER: persiste evento + enqueue {@code stream_moderation_reviews}
 *       con {@code priority=100}.</li>
 *   <li>RED: persiste evento + enqueue con {@code priority=50}.</li>
 *   <li>CRITICAL: persiste evento + enqueue con {@code priority=10} +
 *       invoca {@code streamService.killStreamAsAdmin} con razon
 *       {@code "MODERATION_AUTO_CUT:<category>:<score>"}.</li>
 * </ul>
 *
 * <p>Idempotencia: si el par {@code (provider, providerEventId)} ya
 * existe en {@code stream_moderation_events}, no-op. Si el verdict
 * trae {@code providerEventId=null} (sync sin id del vendor), se
 * sintetiza {@code "sync_<UUID>"} para mantener auditabilidad.
 *
 * <p>Ciclo Spring: depende de {@code StreamService} para el corte
 * CRITICAL. Inyeccion con {@code @Lazy} para romper el ciclo
 * (StreamService no depende directamente de este servicio).
 */
@Service
public class StreamModerationActionService {

    private static final Logger log = LoggerFactory.getLogger(StreamModerationActionService.class);

    private final StreamModerationEventRepository eventRepository;
    private final StreamModerationReviewRepository reviewRepository;
    private final StreamModerationSessionRepository sessionRepository;
    private final StreamService streamService;
    // ADR-050 Fase C+D fix UX 2026-07-15: notificar WS a ambos peers en el
    // auto-cut. Sin esto, killStreamAsAdmin solo cerraba BD pero el
    // frontend seguia mostrando el streaming activo. Los handlers son
    // Lazy para romper posibles ciclos con las dependencias del bean.
    private final MatchingHandler matchingHandler;
    private final MessagesWsHandler messagesWsHandler;

    public StreamModerationActionService(
            StreamModerationEventRepository eventRepository,
            StreamModerationReviewRepository reviewRepository,
            StreamModerationSessionRepository sessionRepository,
            @Lazy StreamService streamService,
            @Lazy MatchingHandler matchingHandler,
            @Lazy MessagesWsHandler messagesWsHandler) {
        this.eventRepository = eventRepository;
        this.reviewRepository = reviewRepository;
        this.sessionRepository = sessionRepository;
        this.streamService = streamService;
        this.matchingHandler = matchingHandler;
        this.messagesWsHandler = messagesWsHandler;
    }

    @Transactional
    public void applyVerdict(StreamModerationSession session, ModerationVerdictResult verdict) {
        if (session == null || verdict == null) {
            log.warn("[STREAM-MOD] applyVerdict invocado con session o verdict null, no-op");
            return;
        }

        // 1) Idempotencia: sintetiza providerEventId si NULL (sync sin id del vendor).
        String providerEventId = verdict.getProviderEventId();
        if (providerEventId == null || providerEventId.isBlank()) {
            providerEventId = "sync_" + UUID.randomUUID();
            verdict.setProviderEventId(providerEventId);
        }

        Optional<StreamModerationEvent> existing = eventRepository
                .findByProviderAndProviderEventId(session.getProvider(), providerEventId);
        if (existing.isPresent()) {
            log.info("[STREAM-MOD] verdict duplicado, no-op providerEventId={} sessionId={}",
                    providerEventId, session.getId());
            return;
        }

        // 2) Persistir evento crudo.
        StreamModerationEvent ev = new StreamModerationEvent();
        ev.setStreamModerationSessionId(session.getId());
        ev.setProvider(session.getProvider());
        ev.setProviderEventId(providerEventId);
        ev.setEventType(Constants.StreamModerationEventType.VERDICT_RECEIVED);
        ev.setProcessed(true);
        ev.setPayloadJson(verdict.getVendorMetadataJson() != null
                ? verdict.getVendorMetadataJson()
                : "{}");
        ev.setProcessedAt(LocalDateTime.now());
        eventRepository.save(ev);

        // 3) Incrementar contador de la sesion.
        session.setVerdictsReceived(session.getVerdictsReceived() + 1);
        sessionRepository.save(session);

        // 4) Tabla de decision por severity.
        String severity = verdict.getSeverityOverall();
        if (severity == null) {
            log.warn("[STREAM-MOD] verdict sin severityOverall sessionId={}, no-op", session.getId());
            return;
        }
        switch (severity) {
            case Constants.StreamModerationSeverity.GREEN:
                return;
            case Constants.StreamModerationSeverity.AMBER:
                createReview(session, verdict, 100);
                return;
            case Constants.StreamModerationSeverity.RED:
                createReview(session, verdict, 50);
                return;
            case Constants.StreamModerationSeverity.CRITICAL:
                StreamModerationReview r = createReview(session, verdict, 10);
                triggerAutoCut(session, r);
                return;
            default:
                log.warn("[STREAM-MOD] severity desconocida '{}' sessionId={}, no-op",
                        severity, session.getId());
        }
    }

    private StreamModerationReview createReview(StreamModerationSession session,
                                                ModerationVerdictResult verdict,
                                                int priority) {
        ModerationCategoryVerdict worst = pickWorstCategory(verdict);
        StreamModerationReview r = new StreamModerationReview();
        r.setStreamRecordId(session.getStreamRecordId());
        r.setStreamModerationSessionId(session.getId());
        r.setProvider(session.getProvider());
        r.setProviderEventId(verdict.getProviderEventId());
        r.setCategory(worst != null
                ? worst.getCategory()
                : Constants.StreamModerationCategory.OTHER);
        r.setSeverity(verdict.getSeverityOverall());
        r.setScore(worst != null && worst.getScore() != null
                ? worst.getScore()
                : BigDecimal.ZERO);
        r.setStatus(Constants.StreamModerationReviewStatus.PENDING);
        r.setPriority(priority);
        if (verdict.getFrameTimestamp() != null) {
            r.setFrameTimestamp(LocalDateTime.ofInstant(
                    verdict.getFrameTimestamp(), ZoneId.systemDefault()));
        }
        StreamModerationReview saved = reviewRepository.save(r);
        log.info("[STREAM-MOD] review enqueued sessionId={} reviewId={} severity={} category={} priority={}",
                session.getId(), saved.getId(), saved.getSeverity(), saved.getCategory(), saved.getPriority());
        return saved;
    }

    private void triggerAutoCut(StreamModerationSession session, StreamModerationReview r) {
        String reason = "MODERATION_AUTO_CUT:" + r.getCategory() + ":" + r.getScore().toPlainString();
        StreamRecord sr = null;
        try {
            sr = streamService.killStreamAsAdmin(session.getStreamRecordId(), reason);
            log.warn("[STREAM-MOD] AUTO-CUT streamRecordId={} sessionId={} reason={}",
                    session.getStreamRecordId(), session.getId(), reason);
        } catch (Exception ex) {
            log.error("[STREAM-MOD] AUTO-CUT FAIL streamRecordId={} sessionId={}: {}",
                    session.getStreamRecordId(), session.getId(), ex.getMessage(), ex);
        }

        // ADR-050 Fase C+D fix UX 2026-07-15: notificar a los peers via WS.
        // Sin esto el frontend seguia mostrando el streaming activo aunque
        // BD estuviera cerrada. Distinguimos RANDOM vs CALLING (mismo patron
        // que AdminController.killStream:265). Fail-soft: cualquier error
        // en la notificacion se loguea pero no propaga (BD ya cerrada, no
        // queremos romper el auto-cut).
        if (sr == null || sr.getClient() == null || sr.getModel() == null
                || sr.getStreamType() == null) {
            return;
        }
        String wsReason = "moderation-auto-cut:" + r.getCategory();
        try {
            if (Constants.StreamTypes.RANDOM.equalsIgnoreCase(sr.getStreamType())) {
                matchingHandler.adminKillPair(
                        sr.getClient().getId(), sr.getModel().getId(), wsReason);
            } else if (Constants.StreamTypes.CALLING.equalsIgnoreCase(sr.getStreamType())) {
                messagesWsHandler.adminKillCallPair(
                        sr.getClient().getId(), sr.getModel().getId(), wsReason);
            }
        } catch (Exception ex) {
            log.warn("[STREAM-MOD] AUTO-CUT WS notify FAIL streamRecordId={} type={}: {}",
                    session.getStreamRecordId(), sr.getStreamType(), ex.getMessage());
        }
    }

    private ModerationCategoryVerdict pickWorstCategory(ModerationVerdictResult verdict) {
        if (verdict.getCategoryVerdicts() == null || verdict.getCategoryVerdicts().isEmpty()) {
            return null;
        }
        ModerationCategoryVerdict worst = null;
        for (ModerationCategoryVerdict c : verdict.getCategoryVerdicts().values()) {
            if (c == null || c.getScore() == null) {
                continue;
            }
            if (worst == null
                    || worst.getScore() == null
                    || c.getScore().compareTo(worst.getScore()) > 0) {
                worst = c;
            }
        }
        return worst;
    }
}
