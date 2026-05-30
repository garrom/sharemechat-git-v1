package com.sharemechat.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Cola de moderación de assets de perfil de modelo (Capa 1: 1 foto + 1 vídeo).
 *
 * <p>Cada upload de pic/video por parte de un modelo genera una fila nueva
 * con {@code status = PENDING_REVIEW}. Admin/SUPPORT deciden APPROVED o
 * REJECTED. La fila previa, si existe, se conserva como histórico.
 *
 * <p>La invariante "modelo visible al cliente" se mantiene en
 * {@code model_documents.pic_approved} y {@code video_approved} (flags
 * denormalizados actualizados por {@code ModelAssetReviewService} al
 * mismo tiempo que se inserta / decide la review).
 *
 * <p>El estado REJECTED en {@code model_asset_reviews} es del asset, no
 * del modelo; es independiente de {@code users.verification_status}. Un
 * asset rechazado no degrada el rol del modelo: el modelo simplemente
 * deja de ser visible al cliente hasta resubir un asset que sea
 * aprobado.
 */
@Entity
@Table(name = "model_asset_reviews")
public class ModelAssetReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** {@code PIC} | {@code VIDEO}. */
    @Column(name = "asset_type", nullable = false, length = 20)
    private String assetType;

    /** Snapshot de la URL del asset al momento del review. */
    @Column(name = "asset_url", nullable = false, length = 500)
    private String assetUrl;

    /** {@code PENDING_REVIEW} | {@code APPROVED} | {@code REJECTED}. */
    @Column(name = "status", nullable = false, length = 20)
    private String status;

    /**
     * Código del motivo de rechazo. Uno de los 10 predefinidos o
     * {@code OTHER}. NULL salvo en filas REJECTED.
     */
    @Column(name = "rejection_reason_code", length = 50)
    private String rejectionReasonCode;

    /**
     * Texto libre adicional al motivo de rechazo. Obligatorio cuando
     * {@link #rejectionReasonCode} = {@code OTHER}; opcional en el
     * resto de casos (notas del moderador).
     */
    @Column(name = "rejection_reason_text", length = 500)
    private String rejectionReasonText;

    /** Momento del upload (alimenta la cola FIFO por ascendente). */
    @Column(name = "uploaded_at", nullable = false)
    private LocalDateTime uploadedAt;

    /** Momento de la decisión. NULL mientras {@code status=PENDING_REVIEW}. */
    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    /**
     * ID del usuario que tomó la decisión. Convención:
     * {@code reviewer_id = NULL AND reviewed_at IS NOT NULL} ⇒ row
     * de grandfather (migración V4, no decisión humana real).
     */
    @Column(name = "reviewer_id")
    private Long reviewerId;

    /** Sello de inserción gestionado por la BD (DEFAULT CURRENT_TIMESTAMP). */
    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    // ----- getters & setters -----

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getAssetType() { return assetType; }
    public void setAssetType(String assetType) { this.assetType = assetType; }

    public String getAssetUrl() { return assetUrl; }
    public void setAssetUrl(String assetUrl) { this.assetUrl = assetUrl; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getRejectionReasonCode() { return rejectionReasonCode; }
    public void setRejectionReasonCode(String rejectionReasonCode) { this.rejectionReasonCode = rejectionReasonCode; }

    public String getRejectionReasonText() { return rejectionReasonText; }
    public void setRejectionReasonText(String rejectionReasonText) { this.rejectionReasonText = rejectionReasonText; }

    public LocalDateTime getUploadedAt() { return uploadedAt; }
    public void setUploadedAt(LocalDateTime uploadedAt) { this.uploadedAt = uploadedAt; }

    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(LocalDateTime reviewedAt) { this.reviewedAt = reviewedAt; }

    public Long getReviewerId() { return reviewerId; }
    public void setReviewerId(Long reviewerId) { this.reviewerId = reviewerId; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
