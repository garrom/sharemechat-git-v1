package com.sharemechat.service;

import com.sharemechat.dto.ModelAssetReviewDTO;
import com.sharemechat.dto.ModelAssetReviewStatsDTO;
import com.sharemechat.entity.ModelAsset;
import com.sharemechat.entity.ModelAssetReview;
import com.sharemechat.entity.User;
import com.sharemechat.repository.ModelAssetRepository;
import com.sharemechat.repository.ModelAssetReviewRepository;
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
 * Servicio de moderación de assets de perfil de modelo (Capa 2).
 *
 * <p>Capa 2: la visibilidad del modelo al cliente NO se mantiene
 * mediante flags denormalizados en {@code model_documents} (que en V5
 * desaparecen). En su lugar las queries del repositorio JOIN
 * directamente con {@code model_assets} y {@code model_asset_reviews}:
 * el modelo es visible si existe al menos un asset principal PIC
 * activo con review APPROVED y al menos un asset principal VIDEO
 * idem. Este service ya no toca flags; solo actualiza el estado de
 * la review concreta.
 *
 * <p>{@link #createPendingReview(com.sharemechat.entity.ModelAsset)}
 * se invoca desde {@code ModelAssetService.upload} cuando el modelo
 * sube un asset nuevo. El asset llega ya persistido (con id), de modo
 * que la review se crea con {@code asset_id} correctamente vinculado.
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
    /**
     * Capa 2 Fase 7: estado nuevo introducido por V6. La review pasa a
     * CANCELLED cuando el modelo elimina su propio asset antes de que
     * el admin decida. Semánticamente distinto de REJECTED (decisión
     * humana del admin sobre un asset entregado para revisión).
     */
    public static final String STATUS_CANCELLED = "CANCELLED";

    public static final String AUDIT_ACTION_APPROVE = "ASSET_APPROVE";
    public static final String AUDIT_ACTION_REJECT = "ASSET_REJECT";
    public static final String AUDIT_ACTION_CANCEL = "ASSET_CANCEL";
    /**
     * Capa 2 Fase 9: rechazo retroactivo de un asset previamente APPROVED.
     * Solo ADMIN. Genera fila REJECTED nueva (la APPROVED histórica
     * queda intacta), desactiva el asset y auto-rota principal si
     * procedía.
     */
    public static final String AUDIT_ACTION_REJECT_RETROACTIVE = "ASSET_REJECT_RETROACTIVE";

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
    private final ModelAssetRepository modelAssetRepository;
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
                                   ModelAssetRepository modelAssetRepository,
                                   UserRepository userRepository,
                                   BackofficeAuditLogService auditLogService,
                                   EmailService emailService,
                                   EmailCopyRenderer emailCopyRenderer) {
        this.reviewRepository = reviewRepository;
        this.modelAssetRepository = modelAssetRepository;
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
        this.emailService = emailService;
        this.emailCopyRenderer = emailCopyRenderer;
    }

    // ============================================================
    // Operaciones de escritura
    // ============================================================

    /**
     * Hook llamado desde {@code ModelAssetService.upload} tras persistir
     * un asset nuevo en {@code model_assets}. Crea una fila PENDING_REVIEW
     * vinculada al asset por {@code asset_id}; el asset queda invisible
     * al cliente hasta que un admin/support apruebe la review (las queries
     * del listado público filtran por la existencia de una review
     * APPROVED por asset).
     */
    @Transactional
    public ModelAssetReview createPendingReview(ModelAsset asset) {
        if (asset == null) {
            throw new IllegalArgumentException("asset requerido");
        }
        if (asset.getId() == null) {
            throw new IllegalArgumentException(
                    "asset debe estar persistido (id no nulo) antes de crear la review");
        }
        requireValidAssetType(asset.getAssetType());

        ModelAssetReview r = new ModelAssetReview();
        r.setUserId(asset.getUserId());
        r.setAssetId(asset.getId());
        r.setAssetType(asset.getAssetType());
        r.setAssetUrl(asset.getUrl());
        r.setStatus(STATUS_PENDING_REVIEW);
        r.setUploadedAt(LocalDateTime.now());
        reviewRepository.save(r);

        log.info("[ASSET-REVIEW] createPendingReview userId={} assetId={} type={} reviewId={}",
                asset.getUserId(), asset.getId(), asset.getAssetType(), r.getId());
        return r;
    }

    /**
     * Aprobación de una review pendiente. Cambia status a APPROVED y
     * escribe audit log. La visibilidad del asset al cliente queda
     * habilitada implícitamente: las queries públicas filtran por
     * existencia de review APPROVED por asset_id.
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

        auditLogService.writeAuditLog(
                reviewerId,
                r.getUserId(),
                AUDIT_ACTION_APPROVE,
                "Aprobado " + r.getAssetType() + " review #" + r.getId(),
                auditPayload(r, null, null)
        );

        log.info("[ASSET-REVIEW] approve reviewId={} userId={} assetId={} type={} reviewer={}",
                r.getId(), r.getUserId(), r.getAssetId(), r.getAssetType(), reviewerId);
        return r;
    }

    /**
     * Rechazo de una review pendiente. Cambia status a REJECTED, escribe
     * audit log y envía email al modelo. El asset deja de ser visible
     * al cliente implícitamente: las queries públicas no lo emparejarán
     * porque no existe review APPROVED para él.
     *
     * <p>Capa 2 Fase 7 (D5): si el asset rechazado era el principal de
     * su tipo (PIC o VIDEO), tras el reject se desmarca como principal
     * y se auto-promueve otro asset del modelo del mismo tipo, activo
     * y aprobado (el primero por id asc). Si no hay candidato, el modelo
     * queda sin principal de ese tipo y desaparece del pool hasta que
     * suba uno nuevo y lo apruebe el admin.
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

        auditLogService.writeAuditLog(
                reviewerId,
                r.getUserId(),
                AUDIT_ACTION_REJECT,
                "Rechazado " + r.getAssetType() + " review #" + r.getId()
                        + " motivo=" + normalizedCode,
                auditPayload(r, normalizedCode, normalizedText)
        );

        autoRotatePrincipalAfterReject(r);

        sendRejectionEmailSafe(r, normalizedCode, normalizedText);

        log.info("[ASSET-REVIEW] reject reviewId={} userId={} assetId={} type={} reviewer={} reason={}",
                r.getId(), r.getUserId(), r.getAssetId(), r.getAssetType(), reviewerId, normalizedCode);
        return r;
    }

    /**
     * Capa 2 Fase 9: rechazo retroactivo de un asset cuya review ya
     * estaba APPROVED. Solo ADMIN (el gate de rol se aplica en el
     * controller). Operación:
     * <ol>
     *   <li>Localiza la review APPROVED por su id; valida estado y
     *       que tenga {@code asset_id} asociado.</li>
     *   <li>NO modifica la review APPROVED original (queda como traza
     *       histórica de la decisión previa del admin).</li>
     *   <li>Crea una fila NUEVA en {@code model_asset_reviews} con
     *       status REJECTED, mismo asset_id/asset_url, motivo elegido
     *       por el admin, reviewerId del admin actual. El
     *       {@code uploadedAt} preserva el original (timeline del
     *       asset, no de la nueva decisión).</li>
     *   <li>Marca el asset físico como {@code is_active=false} para
     *       retirarlo del pool (las queries del listado exigen
     *       {@code pic.isActive=true}) y de la galería expandida.
     *       Decisión técnica: sin esto la APPROVED histórica seguiría
     *       matcheando {@code exists status='APPROVED'} en las 5
     *       queries del pool, y el modelo seguiría visible.</li>
     *   <li>Reusa {@link #autoRotatePrincipalAfterReject} para
     *       desmarcar como principal y promover otro candidato del
     *       mismo tipo si lo hubiera.</li>
     *   <li>Audit log con acción
     *       {@link #AUDIT_ACTION_REJECT_RETROACTIVE}.</li>
     *   <li>Email al modelo idéntico al rechazo estándar.</li>
     * </ol>
     */
    @Transactional
    public ModelAssetReview rejectApprovedRetroactively(Long reviewId,
                                                        Long reviewerId,
                                                        String reasonCode,
                                                        String reasonText) {
        if (reviewId == null) {
            throw new IllegalArgumentException("reviewId requerido");
        }
        ModelAssetReview original = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new IllegalArgumentException("Review no encontrada: " + reviewId));

        if (!STATUS_APPROVED.equals(original.getStatus())) {
            throw new IllegalStateException(
                    "Solo se puede rechazar retroactivamente una review en estado APPROVED (actual="
                            + original.getStatus() + ").");
        }
        if (original.getAssetId() == null) {
            throw new IllegalStateException(
                    "La review #" + reviewId + " no tiene un asset asociado "
                            + "(no se puede rechazar retroactivamente una review huérfana).");
        }

        String normalizedCode = normalizeReasonCode(reasonCode);
        String normalizedText = normalizeReasonText(reasonText);
        validateReason(normalizedCode, normalizedText);

        // Crear fila nueva REJECTED (NO modificar la APPROVED histórica).
        ModelAssetReview rejected = new ModelAssetReview();
        rejected.setUserId(original.getUserId());
        rejected.setAssetId(original.getAssetId());
        rejected.setAssetType(original.getAssetType());
        rejected.setAssetUrl(original.getAssetUrl());
        rejected.setStatus(STATUS_REJECTED);
        // uploadedAt preserva el origen del asset (timeline coherente);
        // reviewedAt es el momento de la decisión retroactiva.
        rejected.setUploadedAt(original.getUploadedAt());
        rejected.setReviewedAt(LocalDateTime.now());
        rejected.setReviewerId(reviewerId);
        rejected.setRejectionReasonCode(normalizedCode);
        rejected.setRejectionReasonText(normalizedText);
        reviewRepository.save(rejected);

        // Desactivar el asset para retirarlo de las superficies cliente
        // (pool teasers, galería expandida del perfil público). Ver Javadoc
        // del método para el razonamiento técnico.
        ModelAsset asset = modelAssetRepository.findById(original.getAssetId()).orElse(null);
        if (asset != null) {
            asset.setActive(false);
            modelAssetRepository.save(asset);
        }

        // Auto-rotación de principal si el asset rechazado era el principal
        // del tipo (mismo helper que el rechazo estándar de Fase 7).
        autoRotatePrincipalAfterReject(rejected);

        auditLogService.writeAuditLog(
                reviewerId,
                original.getUserId(),
                AUDIT_ACTION_REJECT_RETROACTIVE,
                "Rechazo retroactivo " + original.getAssetType() + " review #" + original.getId()
                        + " → nueva review #" + rejected.getId() + " motivo=" + normalizedCode,
                auditPayload(rejected, normalizedCode, normalizedText)
        );

        sendRejectionEmailSafe(rejected, normalizedCode, normalizedText);

        log.info("[ASSET-REVIEW] reject-retroactive originalReviewId={} newReviewId={} userId={} assetId={} type={} reviewer={} reason={}",
                original.getId(), rejected.getId(), original.getUserId(), original.getAssetId(),
                original.getAssetType(), reviewerId, normalizedCode);
        return rejected;
    }

    /**
     * Capa 2 Fase 7: cancela una review PENDING_REVIEW cuando el modelo
     * elimina su propio asset antes de que el admin haya decidido.
     * Llamado por {@code ModelAssetService.delete} ANTES del hard-delete
     * para no dejar una review huérfana en la cola.
     *
     * <p>Idempotente: si no hay review PENDING_REVIEW para el assetId
     * (porque el admin ya decidió o porque nunca existió), no hace
     * nada y devuelve {@code Optional.empty()}.
     */
    @Transactional
    public java.util.Optional<ModelAssetReview> cancelPendingByAssetId(Long assetId, Long actorUserId) {
        if (assetId == null) {
            return java.util.Optional.empty();
        }
        return reviewRepository.findPendingByAssetId(assetId).map(r -> {
            r.setStatus(STATUS_CANCELLED);
            r.setReviewedAt(LocalDateTime.now());
            // reviewerId no aplica (la cancela el modelo, no un admin).
            // Lo dejamos null para distinguir de approve/reject.
            reviewRepository.save(r);

            auditLogService.writeAuditLog(
                    actorUserId,
                    r.getUserId(),
                    AUDIT_ACTION_CANCEL,
                    "Cancelada " + r.getAssetType() + " review #" + r.getId()
                            + " (modelo eliminó el asset antes de la decisión)",
                    auditPayload(r, null, null)
            );

            log.info("[ASSET-REVIEW] cancel reviewId={} userId={} assetId={} type={} (modelo)",
                    r.getId(), r.getUserId(), r.getAssetId(), r.getAssetType());
            return r;
        });
    }

    /**
     * Capa 2 Fase 7 (D5). Tras rechazar una review, si el asset asociado
     * era el principal de su tipo, lo desmarca y promueve otro candidato
     * elegible del modelo (mismo tipo, activo, con review APPROVED,
     * distinto del rechazado, ordenado por id asc).
     *
     * <p>Se invoca como paso post-reject dentro de la misma transacción.
     * Si la review no tiene asset asociado o el asset ya no es principal,
     * no hace nada.
     */
    private void autoRotatePrincipalAfterReject(ModelAssetReview rejected) {
        Long assetId = rejected.getAssetId();
        if (assetId == null) return;

        ModelAsset rejectedAsset = modelAssetRepository.findById(assetId).orElse(null);
        if (rejectedAsset == null) return;
        if (!rejectedAsset.isPrincipal()) return;

        Long userId = rejectedAsset.getUserId();
        String assetType = rejectedAsset.getAssetType();

        // Desmarcamos el rechazado como principal (deja de mostrarse incluso
        // si por error quedara en alguna superficie como tal).
        rejectedAsset.setPrincipal(false);
        modelAssetRepository.save(rejectedAsset);

        // Candidato: mismo tipo, activo, con review APPROVED, distinto del
        // rechazado, id menor primero (FIFO). Reusa la query existente,
        // filtra por tipo y por id distinto, y deduplica por id (defensa
        // contra el edge case grandfather de múltiples reviews por asset).
        java.util.Optional<ModelAsset> next = modelAssetRepository
                .findApprovedActiveByUser(userId).stream()
                .filter(a -> assetType.equals(a.getAssetType()))
                .filter(a -> !a.getId().equals(assetId))
                .collect(java.util.stream.Collectors.toMap(
                        ModelAsset::getId, a -> a, (a, b) -> a, java.util.LinkedHashMap::new))
                .values().stream()
                .min(java.util.Comparator.comparing(ModelAsset::getId));

        if (next.isPresent()) {
            ModelAsset n = next.get();
            n.setPrincipal(true);
            modelAssetRepository.save(n);
            log.info("[ASSET-REVIEW] auto-rotate principal userId={} type={} rejectedAssetId={} newPrincipalAssetId={}",
                    userId, assetType, assetId, n.getId());
        } else {
            log.info("[ASSET-REVIEW] auto-rotate skipped (no candidate) userId={} type={} rejectedAssetId={}",
                    userId, assetType, assetId);
        }
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
        if (!Set.of(STATUS_PENDING_REVIEW, STATUS_APPROVED, STATUS_REJECTED, STATUS_CANCELLED).contains(normalized)) {
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
     * Conveniencia para callers que quieran verificar la visibilidad
     * de un modelo en el pool. En Capa 2 Fase 7 (D4) esta lógica está
     * alineada con las 5 queries del listado público al cliente: exige
     * que exista un asset PRINCIPAL activo APPROVED tanto de PIC como
     * de VIDEO. NO basta con tener "algún" asset aprobado del tipo —
     * tiene que ser el principal, de lo contrario el cliente no lo verá
     * en el teaser. Usar la variante "no-principal" solo cuando lo que
     * se quiera comprobar sea estrictamente "el modelo tiene contenido
     * aprobado del tipo X" (sin garantía de visibilidad en pool).
     */
    @Transactional(readOnly = true)
    public boolean isModelFullyApproved(Long userId) {
        if (userId == null) {
            return false;
        }
        return modelAssetRepository.existsApprovedPrincipalActiveByUserAndType(userId, ASSET_TYPE_PIC)
                && modelAssetRepository.existsApprovedPrincipalActiveByUserAndType(userId, ASSET_TYPE_VIDEO);
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
        // Capa 2 Fase 7 (D3): defensa contra race condition admin vs
        // modelo. Si el modelo elimina su asset mientras el admin tenía
        // la cola abierta, la review puede quedar PENDING_REVIEW con
        // asset_id=NULL (FK ON DELETE SET NULL) si la cancelación
        // explícita falló por cualquier razón. No permitimos decidir
        // sobre una review huérfana.
        if (r.getAssetId() == null) {
            throw new IllegalStateException(
                    "La review #" + reviewId + " ya no tiene un asset asociado "
                            + "(el modelo eliminó el archivo). No se puede aprobar ni rechazar.");
        }
        return r;
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
