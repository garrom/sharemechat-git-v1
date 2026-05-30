package com.sharemechat.service;

import com.sharemechat.dto.ModelAssetReviewDTO;
import com.sharemechat.dto.ModelAssetReviewStatsDTO;
import com.sharemechat.entity.ModelAssetReview;
import com.sharemechat.entity.ModelDocument;
import com.sharemechat.entity.User;
import com.sharemechat.repository.ModelAssetReviewRepository;
import com.sharemechat.repository.ModelDocumentRepository;
import com.sharemechat.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Servicio de moderación de assets de perfil de modelo (Capa 1).
 *
 * <p>Mantiene como invariante:
 * <ul>
 *   <li>{@code model_documents.pic_approved} = TRUE ⇔ la última row PIC
 *       del modelo en {@code model_asset_reviews} está APPROVED.</li>
 *   <li>Análogo para {@code video_approved}.</li>
 * </ul>
 *
 * <p>Las 5 queries de {@code ModelDocumentRepository} que listan modelos
 * visibles al cliente filtran por estos flags. El modelo desaparece de
 * la cola pública automáticamente al rechazar un asset; vuelve a
 * aparecer al aprobar la siguiente subida.
 */
@Service
public class ModelAssetReviewService {

    private static final Logger log = LoggerFactory.getLogger(ModelAssetReviewService.class);

    // ----- Constantes públicas (status / asset types / audit / reason codes) -----

    public static final String ASSET_TYPE_PIC = "PIC";
    public static final String ASSET_TYPE_VIDEO = "VIDEO";

    public static final String STATUS_PENDING_REVIEW = "PENDING_REVIEW";
    public static final String STATUS_APPROVED = "APPROVED";
    public static final String STATUS_REJECTED = "REJECTED";

    public static final String AUDIT_ACTION_APPROVE = "ASSET_APPROVE";
    public static final String AUDIT_ACTION_REJECT = "ASSET_REJECT";

    /** 10 motivos predefinidos + OTHER (texto libre obligatorio). */
    public static final Set<String> VALID_REJECTION_REASON_CODES = Set.of(
            "LIGHTING",
            "QUALITY",
            "EXPLICIT",
            "FACE_NOT_VISIBLE",
            "IDENTITY_MISMATCH",
            "WATERMARK",
            "THIRD_PARTIES",
            "CONTACT_INFO",
            "INVALID_FORMAT",
            "OTHER"
    );
    public static final String REASON_CODE_OTHER = "OTHER";

    // ----- Dependencias -----

    private final ModelAssetReviewRepository reviewRepository;
    private final ModelDocumentRepository modelDocumentRepository;
    private final UserRepository userRepository;
    private final BackofficeAuditLogService auditLogService;
    private final EmailService emailService;
    private final EmailCopyRenderer emailCopyRenderer;

    /**
     * Origen del frontend producto (test/audit/prod) usado como destino
     * del link "Sube nuevo contenido" en el email de rechazo. Resuelto
     * por entorno desde {@code application-<env>.properties}.
     */
    @Value("${app.frontend.product-origin}")
    private String productOrigin;

    public ModelAssetReviewService(ModelAssetReviewRepository reviewRepository,
                                   ModelDocumentRepository modelDocumentRepository,
                                   UserRepository userRepository,
                                   BackofficeAuditLogService auditLogService,
                                   EmailService emailService,
                                   EmailCopyRenderer emailCopyRenderer) {
        this.reviewRepository = reviewRepository;
        this.modelDocumentRepository = modelDocumentRepository;
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
        this.emailService = emailService;
        this.emailCopyRenderer = emailCopyRenderer;
    }

    // ============================================================
    // Operaciones de escritura
    // ============================================================

    /**
     * Hook llamado desde {@code ModelController} tras guardar una nueva URL
     * de foto o vídeo de perfil. Crea una fila PENDING_REVIEW y baja el
     * flag denormalizado correspondiente; el modelo queda invisible al
     * cliente hasta que un admin apruebe la review.
     */
    @Transactional
    public ModelAssetReview createPendingReview(Long userId, String assetType, String assetUrl) {
        requireValidAssetType(assetType);
        if (userId == null) {
            throw new IllegalArgumentException("userId requerido");
        }
        if (assetUrl == null || assetUrl.isBlank()) {
            throw new IllegalArgumentException("assetUrl requerido");
        }

        ModelAssetReview r = new ModelAssetReview();
        r.setUserId(userId);
        r.setAssetType(assetType);
        r.setAssetUrl(assetUrl);
        r.setStatus(STATUS_PENDING_REVIEW);
        r.setUploadedAt(LocalDateTime.now());
        reviewRepository.save(r);

        setApprovedFlag(userId, assetType, false);

        log.info("[ASSET-REVIEW] createPendingReview userId={} type={} reviewId={}",
                userId, assetType, r.getId());
        return r;
    }

    /**
     * Aprobación de una review pendiente. Cambia status a APPROVED, sube el
     * flag denormalizado y escribe el audit log.
     */
    @Transactional
    public ModelAssetReview approveReview(Long reviewId, Long reviewerId) {
        ModelAssetReview r = loadPendingOrThrow(reviewId);

        r.setStatus(STATUS_APPROVED);
        r.setReviewedAt(LocalDateTime.now());
        r.setReviewerId(reviewerId);
        r.setRejectionReasonCode(null);
        r.setRejectionReasonText(null);
        reviewRepository.save(r);

        setApprovedFlag(r.getUserId(), r.getAssetType(), true);

        auditLogService.writeAuditLog(
                reviewerId,
                r.getUserId(),
                AUDIT_ACTION_APPROVE,
                "Aprobado " + r.getAssetType() + " review #" + r.getId(),
                auditPayload(r, null, null)
        );

        log.info("[ASSET-REVIEW] approve reviewId={} userId={} type={} reviewer={}",
                r.getId(), r.getUserId(), r.getAssetType(), reviewerId);
        return r;
    }

    /**
     * Rechazo de una review pendiente. Cambia status a REJECTED, baja el
     * flag denormalizado, escribe audit log y envía email al modelo.
     */
    @Transactional
    public ModelAssetReview rejectReview(Long reviewId,
                                         Long reviewerId,
                                         String reasonCode,
                                         String reasonText) {
        ModelAssetReview r = loadPendingOrThrow(reviewId);

        String normalizedCode = normalizeReasonCode(reasonCode);
        String normalizedText = normalizeReasonText(reasonText);
        validateReason(normalizedCode, normalizedText);

        r.setStatus(STATUS_REJECTED);
        r.setReviewedAt(LocalDateTime.now());
        r.setReviewerId(reviewerId);
        r.setRejectionReasonCode(normalizedCode);
        r.setRejectionReasonText(normalizedText);
        reviewRepository.save(r);

        setApprovedFlag(r.getUserId(), r.getAssetType(), false);

        auditLogService.writeAuditLog(
                reviewerId,
                r.getUserId(),
                AUDIT_ACTION_REJECT,
                "Rechazado " + r.getAssetType() + " review #" + r.getId()
                        + " motivo=" + normalizedCode,
                auditPayload(r, normalizedCode, normalizedText)
        );

        sendRejectionEmailSafe(r, normalizedCode, normalizedText);

        log.info("[ASSET-REVIEW] reject reviewId={} userId={} type={} reviewer={} reason={}",
                r.getId(), r.getUserId(), r.getAssetType(), reviewerId, normalizedCode);
        return r;
    }

    // ============================================================
    // Lectura para el panel admin
    // ============================================================

    @Transactional(readOnly = true)
    public java.util.List<ModelAssetReviewDTO> getReviewQueue() {
        return reviewRepository.findDTOsByStatusOrderByUploadedAtAsc(STATUS_PENDING_REVIEW);
    }

    @Transactional(readOnly = true)
    public java.util.List<ModelAssetReviewDTO> getReviewsByStatus(String status) {
        String normalized = status == null ? STATUS_PENDING_REVIEW : status.trim().toUpperCase();
        if (!Set.of(STATUS_PENDING_REVIEW, STATUS_APPROVED, STATUS_REJECTED).contains(normalized)) {
            throw new IllegalArgumentException("status no soportado: " + status);
        }
        return reviewRepository.findDTOsByStatusOrderByUploadedAtAsc(normalized);
    }

    @Transactional(readOnly = true)
    public ModelAssetReviewStatsDTO getStats() {
        return new ModelAssetReviewStatsDTO(
                reviewRepository.countByStatus(STATUS_PENDING_REVIEW),
                reviewRepository.countByStatus(STATUS_APPROVED),
                reviewRepository.countByStatus(STATUS_REJECTED)
        );
    }

    /**
     * Conveniencia para callers que quieran verificar el estado de un
     * modelo (p. ej. tests, jobs futuros). Lee los flags denormalizados
     * — la fuente de verdad mantenida por este service.
     */
    @Transactional(readOnly = true)
    public boolean isModelFullyApproved(Long userId) {
        if (userId == null) {
            return false;
        }
        ModelDocument doc = modelDocumentRepository.findById(userId).orElse(null);
        return doc != null && doc.isPicApproved() && doc.isVideoApproved();
    }

    // ============================================================
    // Internals
    // ============================================================

    private ModelAssetReview loadPendingOrThrow(Long reviewId) {
        if (reviewId == null) {
            throw new IllegalArgumentException("reviewId requerido");
        }
        ModelAssetReview r = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new IllegalArgumentException("Review no encontrada: " + reviewId));
        if (!STATUS_PENDING_REVIEW.equals(r.getStatus())) {
            throw new IllegalStateException(
                    "La review #" + reviewId + " no está en estado PENDING_REVIEW (actual="
                            + r.getStatus() + "). Solo se puede decidir una pendiente.");
        }
        return r;
    }

    private void setApprovedFlag(Long userId, String assetType, boolean approved) {
        ModelDocument doc = modelDocumentRepository.findById(userId).orElse(null);
        if (doc == null) {
            // El upload normal crea/actualiza ModelDocument antes de
            // crear la review. Si no existe aquí, dejamos warning y
            // seguimos: el flag se materializará al próximo save de ese
            // documento; el endpoint de listing seguirá protegido por el
            // valor por defecto (FALSE).
            log.warn("[ASSET-REVIEW] setApprovedFlag: ModelDocument no encontrado para userId={} type={}",
                    userId, assetType);
            return;
        }
        if (ASSET_TYPE_PIC.equals(assetType)) {
            doc.setPicApproved(approved);
        } else if (ASSET_TYPE_VIDEO.equals(assetType)) {
            doc.setVideoApproved(approved);
        }
        modelDocumentRepository.save(doc);
    }

    private static void requireValidAssetType(String assetType) {
        if (!ASSET_TYPE_PIC.equals(assetType) && !ASSET_TYPE_VIDEO.equals(assetType)) {
            throw new IllegalArgumentException(
                    "assetType no válido: " + assetType + " (esperado PIC o VIDEO)");
        }
    }

    private static String normalizeReasonCode(String code) {
        return code == null ? null : code.trim().toUpperCase();
    }

    private static String normalizeReasonText(String text) {
        if (text == null) {
            return null;
        }
        String trimmed = text.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static void validateReason(String code, String text) {
        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException("reasonCode requerido");
        }
        if (!VALID_REJECTION_REASON_CODES.contains(code)) {
            throw new IllegalArgumentException(
                    "reasonCode no permitido: " + code
                            + " (válidos: " + VALID_REJECTION_REASON_CODES + ")");
        }
        if (REASON_CODE_OTHER.equals(code) && (text == null || text.isBlank())) {
            throw new IllegalArgumentException(
                    "reasonText es obligatorio cuando reasonCode='OTHER'");
        }
    }

    private static Map<String, Object> auditPayload(ModelAssetReview r,
                                                    String rejectionCode,
                                                    String rejectionText) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("resource_type", "MODEL_ASSET");
        payload.put("resource_id", r.getId());
        payload.put("asset_type", r.getAssetType());
        payload.put("asset_url", r.getAssetUrl());
        payload.put("rejection_reason_code", rejectionCode);
        payload.put("rejection_reason_text", rejectionText);
        return payload;
    }

    // ----- Email de rechazo (delegado en EmailCopyRenderer; alineado con
    //       el patrón del resto de emails del sistema: bilingüe por
    //       user.ui_locale, default EN si no es ES) -----

    private void sendRejectionEmailSafe(ModelAssetReview r, String reasonCode, String reasonText) {
        try {
            User user = userRepository.findById(r.getUserId()).orElse(null);
            if (user == null || user.getEmail() == null || user.getEmail().isBlank()) {
                log.warn("[ASSET-REVIEW] email rechazo no enviado: user sin email userId={}",
                        r.getUserId());
                return;
            }

            EmailCopyRenderer.EmailContent content = emailCopyRenderer.renderAssetRejection(
                    user,
                    r.getAssetType(),
                    reasonCode,
                    reasonText,
                    productOrigin
            );

            emailService.send(new EmailMessage(
                    user.getEmail(),
                    content.subject(),
                    content.body(),
                    EmailMessage.Category.MODEL_ASSET_REJECTION,
                    EmailMessage.Priority.BEST_EFFORT
            ));
        } catch (RuntimeException ex) {
            // Email es BEST_EFFORT; no debe abortar la transacción del reject.
            log.warn("[ASSET-REVIEW] error enviando email de rechazo reviewId={}: {}",
                    r.getId(), ex.getMessage());
        }
    }
}
