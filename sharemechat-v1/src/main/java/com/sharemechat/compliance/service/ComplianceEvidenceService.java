package com.sharemechat.compliance.service;

import com.sharemechat.compliance.dto.EvidenceSignedUrlDTO;
import com.sharemechat.config.ModerationEvidenceProperties;
import com.sharemechat.constants.Constants;
import com.sharemechat.service.BackofficeAuditLogService;
import com.sharemechat.streammoderation.entity.StreamModerationEvent;
import com.sharemechat.streammoderation.entity.StreamModerationReview;
import com.sharemechat.streammoderation.repository.StreamModerationEventRepository;
import com.sharemechat.streammoderation.repository.StreamModerationReviewRepository;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Genera signed URL temporal de acceso a la imagen evidencia S3
 * asociada a un event (via el review enlazado por provider_event_id).
 * Cada acceso queda registrado en backoffice_access_audit_log con
 * action COMPLIANCE_EVIDENCE_ACCESS (DEC-CD-3 + DEC-CD-H).
 *
 * <p>TTL configurable via {@code compliance.evidence.signed-url-ttl-seconds}
 * (default 600 = 10 min, estandar industria adult/UGC). DEC-CD-D.
 *
 * <p>Eventos GREEN no tienen evidence_ref (no se subio nada al bucket).
 * En ese caso el endpoint devuelve {@code url=null} con razon explicita
 * en lugar de 404 (DEC-CD-C). Permite al frontend mostrar mensaje
 * contextual sin gestionar status code especial.
 */
@Service
public class ComplianceEvidenceService {

    private static final Logger log = LoggerFactory.getLogger(ComplianceEvidenceService.class);

    static final String REASON_GREEN_VERDICT = "No evidence captured for GREEN verdict";
    static final String REASON_NO_REVIEW = "No review linked to this event";
    static final String REASON_BUCKET_UNAVAILABLE = "Evidence bucket not configured in this environment";

    private final ModerationEvidenceProperties props;
    private final StreamModerationEventRepository eventRepository;
    private final StreamModerationReviewRepository reviewRepository;
    private final BackofficeAuditLogService backofficeAuditLogService;

    @Value("${compliance.evidence.signed-url-ttl-seconds:600}")
    private long ttlSeconds;

    private S3Presigner presigner;

    public ComplianceEvidenceService(ModerationEvidenceProperties props,
                                      StreamModerationEventRepository eventRepository,
                                      StreamModerationReviewRepository reviewRepository,
                                      BackofficeAuditLogService backofficeAuditLogService) {
        this.props = props;
        this.eventRepository = eventRepository;
        this.reviewRepository = reviewRepository;
        this.backofficeAuditLogService = backofficeAuditLogService;
    }

    @PostConstruct
    void init() {
        if (!StringUtils.hasText(props.getBucket()) || !StringUtils.hasText(props.getRegion())) {
            log.warn("[COMPLIANCE-EVIDENCE] bucket/region blank; presigner queda como no-op");
            return;
        }
        this.presigner = S3Presigner.builder()
                .region(Region.of(props.getRegion()))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build();
        log.info("[COMPLIANCE-EVIDENCE] presigner ready bucket={} region={} ttl_s={}",
                props.getBucket(), props.getRegion(), ttlSeconds);
    }

    @PreDestroy
    void close() {
        if (presigner != null) presigner.close();
    }

    public EvidenceSignedUrlDTO generateSignedUrl(Long eventId, Long actorUserId, String clientIp) {
        if (eventId == null) throw new IllegalArgumentException("eventId requerido");

        StreamModerationEvent event = eventRepository.findById(eventId)
                .orElseThrow(() -> new IllegalArgumentException("Event no encontrado"));

        Optional<StreamModerationReview> reviewOpt = Optional.empty();
        if (StringUtils.hasText(event.getProviderEventId())) {
            reviewOpt = reviewRepository.findByProviderAndProviderEventId(
                    event.getProvider(), event.getProviderEventId());
        }
        if (reviewOpt.isEmpty()) {
            writeAuditLog(eventId, null, null, actorUserId, clientIp, REASON_GREEN_VERDICT);
            return new EvidenceSignedUrlDTO(null, REASON_GREEN_VERDICT, null, ttlSeconds);
        }
        StreamModerationReview review = reviewOpt.get();
        if (!StringUtils.hasText(review.getEvidenceRef())) {
            writeAuditLog(eventId, review.getId(), null, actorUserId, clientIp, REASON_GREEN_VERDICT);
            return new EvidenceSignedUrlDTO(null, REASON_GREEN_VERDICT, null, ttlSeconds);
        }
        if (presigner == null) {
            writeAuditLog(eventId, review.getId(), review.getEvidenceRef(),
                    actorUserId, clientIp, REASON_BUCKET_UNAVAILABLE);
            return new EvidenceSignedUrlDTO(null, REASON_BUCKET_UNAVAILABLE, null, ttlSeconds);
        }

        GetObjectRequest get = GetObjectRequest.builder()
                .bucket(props.getBucket())
                .key(review.getEvidenceRef())
                .build();
        GetObjectPresignRequest presign = GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofSeconds(ttlSeconds))
                .getObjectRequest(get)
                .build();
        PresignedGetObjectRequest result = presigner.presignGetObject(presign);
        LocalDateTime expiresAt = LocalDateTime.now().plusSeconds(ttlSeconds);

        writeAuditLog(eventId, review.getId(), review.getEvidenceRef(),
                actorUserId, clientIp, "OK");

        log.info("[COMPLIANCE-EVIDENCE] signed url generated eventId={} reviewId={} actor={} ttl_s={}",
                eventId, review.getId(), actorUserId, ttlSeconds);
        return new EvidenceSignedUrlDTO(result.url().toString(), null, expiresAt, ttlSeconds);
    }

    private void writeAuditLog(Long eventId, Long reviewId, String evidenceRef,
                                Long actorUserId, String clientIp, String outcome) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("eventId", eventId);
            payload.put("reviewId", reviewId);
            payload.put("evidenceRef", evidenceRef);
            payload.put("clientIp", clientIp);
            payload.put("ttlSeconds", ttlSeconds);
            payload.put("outcome", outcome);
            // target_user_id NOT NULL en backoffice_access_audit_log; cuando el "target"
            // logico es el contenido (no un usuario), reusamos el actor (admin que accede)
            // para cumplir el constraint sin alterar el schema (DEC-CD-3 + DEC-CD-A).
            Long targetForLog = actorUserId != null ? actorUserId : 0L;
            backofficeAuditLogService.writeAuditLog(actorUserId, targetForLog,
                    Constants.ComplianceAuditActions.COMPLIANCE_EVIDENCE_ACCESS,
                    "Acceso a evidencia eventId=" + eventId + " outcome=" + outcome,
                    payload);
        } catch (Exception ignore) {
            // best-effort
        }
    }

    // hook para tests
    void setPresignerForTests(S3Presigner p) { this.presigner = p; }
    void setTtlSecondsForTests(long s) { this.ttlSeconds = s; }
}
