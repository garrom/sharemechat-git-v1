package com.sharemechat.streammoderation.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.StreamRecord;
import com.sharemechat.repository.StreamRecordRepository;
import com.sharemechat.service.BackofficeAuditLogService;
import com.sharemechat.service.StreamService;
import com.sharemechat.streammoderation.dto.StreamModerationConfigDTO;
import com.sharemechat.streammoderation.dto.StreamModerationEventDTO;
import com.sharemechat.streammoderation.dto.StreamModerationReviewDetailDTO;
import com.sharemechat.streammoderation.dto.StreamModerationReviewListItemDTO;
import com.sharemechat.streammoderation.dto.StreamModerationSessionDetailDTO;
import com.sharemechat.streammoderation.dto.StreamModerationSessionListItemDTO;
import com.sharemechat.streammoderation.dto.StreamModerationStatsDTO;
import com.sharemechat.streammoderation.entity.StreamModerationEvent;
import com.sharemechat.streammoderation.entity.StreamModerationProviderConfig;
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

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Servicio admin del frente Moderacion IA (ADR-030 / ADR-036 / ADR-037).
 *
 * <p>Separa la responsabilidad runtime (orquestacion de verdicts en
 * {@link StreamModerationActionService} y ciclo de sesiones en
 * {@link StreamModerationSessionService}) de la responsabilidad admin
 * (cola humana, listados, decisiones, config). Esto evita acumular
 * superficie en los services runtime y mantiene los controllers
 * delgados (calcando el patron de {@code ModelAssetReviewService}).
 *
 * <p>Politicas zanjadas en Fase A:
 * <ul>
 *   <li>Approve: marca APPROVED + audit log. No-op adicional.</li>
 *   <li>Reject: marca REJECTED + audit log. Si
 *       {@code killStreamIfActive=true} y stream activo, invoca
 *       {@code streamService.killStreamAsAdmin}.</li>
 *   <li>UpdateMode: valida set permitido, persiste, audit log.</li>
 *   <li>{@code targetUserId} del audit log = {@code StreamRecord.model.id}
 *       (K1: el modelo protagoniza la moderacion visual del stream).</li>
 * </ul>
 *
 * <p>Ciclo Spring: depende de {@link StreamService} para
 * {@code killStreamAsAdmin}; {@code @Lazy} en el constructor evita
 * cualquier riesgo de ciclo con la cadena
 * {@link StreamService} -> {@link StreamModerationSessionService}.
 */
@Service
public class StreamModerationAdminService {

    private static final Logger log = LoggerFactory.getLogger(StreamModerationAdminService.class);

    private static final int MAX_NOTE_LENGTH = 255;
    private static final int MAX_DECISION_CODE_LENGTH = 50;
    private static final int DETAIL_EVENTS_LIMIT = 20;

    private static final String DECISION_CODE_APPROVED_BY_ADMIN = "APPROVED_BY_ADMIN";

    private static final String AUDIT_ACTION_APPROVE = "STREAM_MODERATION_REVIEW_APPROVE";
    private static final String AUDIT_ACTION_REJECT = "STREAM_MODERATION_REVIEW_REJECT";
    private static final String AUDIT_ACTION_CONFIG_CHANGE = "STREAM_MODERATION_PROVIDER_CONFIG_CHANGE";

    private static final Set<String> SUPPORTED_MODES = Set.of(
            Constants.StreamModerationProvider.MOCK,
            Constants.StreamModerationProvider.SIGHTENGINE,
            Constants.StreamModerationProvider.HIVE,
            Constants.StreamModerationProvider.REKOGNITION
    );

    private final StreamModerationReviewRepository reviewRepository;
    private final StreamModerationSessionRepository sessionRepository;
    private final StreamModerationEventRepository eventRepository;
    private final StreamModerationProviderConfigService providerConfigService;
    private final StreamRecordRepository streamRecordRepository;
    private final StreamService streamService;
    private final BackofficeAuditLogService auditLogService;

    public StreamModerationAdminService(
            StreamModerationReviewRepository reviewRepository,
            StreamModerationSessionRepository sessionRepository,
            StreamModerationEventRepository eventRepository,
            StreamModerationProviderConfigService providerConfigService,
            StreamRecordRepository streamRecordRepository,
            @Lazy StreamService streamService,
            BackofficeAuditLogService auditLogService) {
        this.reviewRepository = reviewRepository;
        this.sessionRepository = sessionRepository;
        this.eventRepository = eventRepository;
        this.providerConfigService = providerConfigService;
        this.streamRecordRepository = streamRecordRepository;
        this.streamService = streamService;
        this.auditLogService = auditLogService;
    }

    // ============================================================
    // Cola humana
    // ============================================================

    public List<StreamModerationReviewListItemDTO> listQueue(String statusFilter,
                                                             String severityFilter,
                                                             String categoryFilter) {
        String status = isBlank(statusFilter)
                ? Constants.StreamModerationReviewStatus.PENDING
                : statusFilter.trim().toUpperCase();
        List<StreamModerationReview> rows = reviewRepository
                .findByStatusOrderByPriorityAscCreatedAtAsc(status);

        String severity = isBlank(severityFilter) ? null : severityFilter.trim().toUpperCase();
        String category = isBlank(categoryFilter) ? null : categoryFilter.trim().toUpperCase();

        return rows.stream()
                .filter(r -> severity == null || severity.equals(r.getSeverity()))
                .filter(r -> category == null || category.equals(r.getCategory()))
                .map(this::mapReviewToListItem)
                .collect(Collectors.toList());
    }

    public StreamModerationReviewDetailDTO getReviewDetail(Long reviewId) {
        StreamModerationReview r = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new IllegalArgumentException("Review no encontrada: " + reviewId));
        List<StreamModerationEventDTO> events = eventRepository
                .findByStreamModerationSessionIdOrderByReceivedAtDesc(r.getStreamModerationSessionId())
                .stream()
                .limit(DETAIL_EVENTS_LIMIT)
                .map(this::mapEvent)
                .collect(Collectors.toList());
        return new StreamModerationReviewDetailDTO(
                mapReviewToListItem(r),
                r.getEvidenceRef(),
                r.getDecisionCode(),
                r.getDecisionNote(),
                events
        );
    }

    public StreamModerationStatsDTO getStats() {
        long pending = countByStatus(Constants.StreamModerationReviewStatus.PENDING);
        long inReview = countByStatus(Constants.StreamModerationReviewStatus.IN_REVIEW);
        long approved = countByStatus(Constants.StreamModerationReviewStatus.APPROVED);
        long rejected = countByStatus(Constants.StreamModerationReviewStatus.REJECTED);
        long cancelled = countByStatus(Constants.StreamModerationReviewStatus.CANCELLED);
        return new StreamModerationStatsDTO(pending, inReview, approved, rejected, cancelled);
    }

    @Transactional
    public StreamModerationReviewListItemDTO approveReview(Long reviewId, Long actorUserId, String note) {
        StreamModerationReview r = loadPendingOrThrow(reviewId);
        String safeNote = sanitizeNote(note);

        r.setStatus(Constants.StreamModerationReviewStatus.APPROVED);
        r.setReviewerId(actorUserId);
        r.setReviewedAt(LocalDateTime.now());
        r.setDecisionCode(DECISION_CODE_APPROVED_BY_ADMIN);
        r.setDecisionNote(safeNote);
        StreamModerationReview saved = reviewRepository.save(r);

        Long targetUserId = resolveModelUserId(saved.getStreamRecordId());
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("reviewId", saved.getId());
        payload.put("streamRecordId", saved.getStreamRecordId());
        payload.put("severity", saved.getSeverity());
        payload.put("category", saved.getCategory());
        payload.put("score", saved.getScore() == null ? null : saved.getScore().toPlainString());
        payload.put("decisionCode", saved.getDecisionCode());
        if (safeNote != null) {
            payload.put("note", safeNote);
        }

        String summary = "Aprobada review stream-moderation #" + saved.getId()
                + " severidad=" + saved.getSeverity()
                + " categoria=" + saved.getCategory();

        auditLogService.writeAuditLog(actorUserId, targetUserId, AUDIT_ACTION_APPROVE, summary, payload);
        log.info("[STREAM-MOD] review approved reviewId={} actor={} target={}",
                saved.getId(), actorUserId, targetUserId);
        return mapReviewToListItem(saved);
    }

    @Transactional
    public StreamModerationReviewListItemDTO rejectReview(Long reviewId,
                                                          Long actorUserId,
                                                          String decisionCode,
                                                          String note,
                                                          Boolean killStreamIfActive) {
        StreamModerationReview r = loadPendingOrThrow(reviewId);

        if (isBlank(decisionCode)) {
            throw new IllegalArgumentException("decisionCode requerido");
        }
        String safeDecisionCode = decisionCode.trim();
        if (safeDecisionCode.length() > MAX_DECISION_CODE_LENGTH) {
            throw new IllegalArgumentException("decisionCode supera " + MAX_DECISION_CODE_LENGTH + " caracteres");
        }
        String safeNote = sanitizeNote(note);
        boolean wantKill = Boolean.TRUE.equals(killStreamIfActive);

        r.setStatus(Constants.StreamModerationReviewStatus.REJECTED);
        r.setReviewerId(actorUserId);
        r.setReviewedAt(LocalDateTime.now());
        r.setDecisionCode(safeDecisionCode);
        r.setDecisionNote(safeNote);
        StreamModerationReview saved = reviewRepository.save(r);

        boolean streamKilled = false;
        String killError = null;
        String killSkippedReason = null;
        if (wantKill) {
            Optional<StreamRecord> srOpt = streamRecordRepository.findById(saved.getStreamRecordId());
            if (srOpt.isEmpty()) {
                killSkippedReason = "stream_record_not_found";
            } else if (srOpt.get().getEndTime() != null) {
                killSkippedReason = "already_ended";
            } else {
                try {
                    streamService.killStreamAsAdmin(
                            saved.getStreamRecordId(),
                            "MODERATION_REVIEW_REJECT:" + safeDecisionCode);
                    streamKilled = true;
                } catch (Exception ex) {
                    killError = ex.getMessage();
                    log.warn("[STREAM-MOD] killStreamAsAdmin fallo reviewId={} streamRecordId={}: {}",
                            saved.getId(), saved.getStreamRecordId(), killError);
                }
            }
        }

        Long targetUserId = resolveModelUserId(saved.getStreamRecordId());
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("reviewId", saved.getId());
        payload.put("streamRecordId", saved.getStreamRecordId());
        payload.put("severity", saved.getSeverity());
        payload.put("category", saved.getCategory());
        payload.put("decisionCode", safeDecisionCode);
        payload.put("killStreamIfActive", wantKill);
        payload.put("streamKilled", streamKilled);
        if (killSkippedReason != null) {
            payload.put("killSkippedReason", killSkippedReason);
        }
        if (killError != null) {
            payload.put("killError", killError);
        }
        if (safeNote != null) {
            payload.put("note", safeNote);
        }

        String summary = "Rechazada review stream-moderation #" + saved.getId()
                + " severidad=" + saved.getSeverity()
                + " categoria=" + saved.getCategory()
                + (wantKill ? (streamKilled ? " (stream cortado)" : " (stream no cortado)") : "");

        auditLogService.writeAuditLog(actorUserId, targetUserId, AUDIT_ACTION_REJECT, summary, payload);
        log.info("[STREAM-MOD] review rejected reviewId={} actor={} target={} streamKilled={}",
                saved.getId(), actorUserId, targetUserId, streamKilled);
        return mapReviewToListItem(saved);
    }

    // ============================================================
    // Sesiones
    // ============================================================

    public List<StreamModerationSessionListItemDTO> listSessions(String statusFilter) {
        List<StreamModerationSession> rows;
        if (isBlank(statusFilter)) {
            rows = sessionRepository.findAll();
        } else {
            rows = sessionRepository.findByStatus(statusFilter.trim().toUpperCase());
        }
        return rows.stream()
                .map(this::mapSessionToListItem)
                .collect(Collectors.toList());
    }

    public StreamModerationSessionDetailDTO getSessionDetail(Long sessionId) {
        StreamModerationSession s = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Sesion no encontrada: " + sessionId));
        List<StreamModerationEventDTO> events = eventRepository
                .findByStreamModerationSessionIdOrderByReceivedAtDesc(s.getId())
                .stream()
                .limit(DETAIL_EVENTS_LIMIT)
                .map(this::mapEvent)
                .collect(Collectors.toList());
        return new StreamModerationSessionDetailDTO(mapSessionToListItem(s), events);
    }

    // ============================================================
    // Config
    // ============================================================

    public StreamModerationConfigDTO getConfig() {
        return mapConfig(providerConfigService.getOrCreateConfig());
    }

    @Transactional
    public StreamModerationConfigDTO updateMode(String newMode, Long actorUserId, String note) {
        if (isBlank(newMode)) {
            throw new IllegalArgumentException("mode requerido");
        }
        String normalized = newMode.trim().toUpperCase();
        if (!SUPPORTED_MODES.contains(normalized)) {
            throw new IllegalArgumentException("Modo no soportado: " + newMode);
        }
        String safeNote = sanitizeNote(note);
        String previousMode = providerConfigService.getActiveMode();
        StreamModerationProviderConfig updated = providerConfigService.setActiveMode(normalized, actorUserId, safeNote);

        Map<String, Object> payload = new HashMap<>();
        payload.put("providerKey", updated.getProviderKey());
        payload.put("previousMode", previousMode);
        payload.put("newMode", normalized);
        if (safeNote != null) {
            payload.put("note", safeNote);
        }
        String summary = "Cambio de modo stream-moderation: " + previousMode + " -> " + normalized;

        // targetUserId = actorUserId cuando la accion no recae sobre otro user
        // (cambio de config global; no aplica a una cuenta concreta).
        auditLogService.writeAuditLog(actorUserId, actorUserId, AUDIT_ACTION_CONFIG_CHANGE, summary, payload);
        log.info("[STREAM-MOD] active_mode change actor={} {} -> {}", actorUserId, previousMode, normalized);
        return mapConfig(updated);
    }

    // ============================================================
    // Helpers privados
    // ============================================================

    private StreamModerationReview loadPendingOrThrow(Long reviewId) {
        StreamModerationReview r = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new IllegalArgumentException("Review no encontrada: " + reviewId));
        String status = r.getStatus();
        if (!Constants.StreamModerationReviewStatus.PENDING.equals(status)
                && !Constants.StreamModerationReviewStatus.IN_REVIEW.equals(status)) {
            throw new IllegalStateException("Review no decidible en estado " + status);
        }
        return r;
    }

    private long countByStatus(String status) {
        // Volumen pre-launch trivial; lista plana en memoria.
        // Si en P2 el volumen crece, sustituir por countByStatus derivado.
        return reviewRepository.findByStatusOrderByPriorityAscCreatedAtAsc(status).size();
    }

    private Long resolveModelUserId(Long streamRecordId) {
        if (streamRecordId == null) {
            return null;
        }
        Optional<StreamRecord> opt = streamRecordRepository.findById(streamRecordId);
        if (opt.isEmpty() || opt.get().getModel() == null) {
            return null;
        }
        return opt.get().getModel().getId();
    }

    private String sanitizeNote(String note) {
        if (note == null) {
            return null;
        }
        String trimmed = note.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.length() > MAX_NOTE_LENGTH) {
            throw new IllegalArgumentException("note supera " + MAX_NOTE_LENGTH + " caracteres");
        }
        return trimmed;
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    private StreamModerationReviewListItemDTO mapReviewToListItem(StreamModerationReview r) {
        return new StreamModerationReviewListItemDTO(
                r.getId(),
                r.getStreamRecordId(),
                r.getStreamModerationSessionId(),
                r.getProvider(),
                r.getCategory(),
                r.getSeverity(),
                r.getScore(),
                r.getProviderEventId(),
                r.getStatus(),
                r.getPriority(),
                r.getReviewerId(),
                r.getReviewedAt(),
                r.getFrameTimestamp(),
                r.getCreatedAt()
        );
    }

    private StreamModerationSessionListItemDTO mapSessionToListItem(StreamModerationSession s) {
        return new StreamModerationSessionListItemDTO(
                s.getId(),
                s.getStreamRecordId(),
                s.getProvider(),
                s.getStatus(),
                s.getSamplingCadenceSeconds(),
                s.getSamplingStrategy(),
                s.getStartedAt(),
                s.getStoppedAt(),
                s.getFramesSubmitted(),
                s.getVerdictsReceived(),
                s.getDegradedSince()
        );
    }

    private StreamModerationEventDTO mapEvent(StreamModerationEvent e) {
        return new StreamModerationEventDTO(
                e.getId(),
                e.getProvider(),
                e.getProviderEventId(),
                e.getEventType(),
                e.getSignatureValid(),
                e.isProcessed(),
                e.getReceivedAt(),
                e.getProcessedAt()
        );
    }

    private StreamModerationConfigDTO mapConfig(StreamModerationProviderConfig c) {
        return new StreamModerationConfigDTO(
                c.getProviderKey(),
                c.getActiveMode(),
                c.isEnabled(),
                c.getNote(),
                c.getUpdatedByUserId(),
                c.getUpdatedAt()
        );
    }
}
