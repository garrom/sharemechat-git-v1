package com.sharemechat.streammoderation.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Ban emitido automaticamente sobre una modelo al acumular strikes
 * (ADR-037 frente trial-sfw Bloque 3). Escalada:
 * <ul>
 *   <li>1 strike -> 15 min</li>
 *   <li>2 strikes -> 30 min</li>
 *   <li>3 strikes -> 1 h</li>
 *   <li>4 strikes -> 6 h</li>
 *   <li>5+ strikes -> 24 h + {@code requires_manual_review=true}</li>
 * </ul>
 *
 * <p>El estado "actualmente baneada" para el gate del matching vive en
 * {@code models.streaming_banned_until}; esta tabla es historial completo
 * + fuente para el panel del Bloque 4 (audit trail + revision manual).
 */
@Entity
@Table(name = "model_moderation_bans")
public class ModelModerationBan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "model_user_id", nullable = false)
    private Long modelUserId;

    @Column(name = "strike_count_at_ban", nullable = false)
    private int strikeCountAtBan;

    @Column(name = "ban_started_at", insertable = false, updatable = false)
    private LocalDateTime banStartedAt;

    @Column(name = "ban_ends_at", nullable = false)
    private LocalDateTime banEndsAt;

    @Column(name = "reason", nullable = false, length = 200)
    private String reason;

    @Column(name = "source_strike_id", nullable = false)
    private Long sourceStrikeId;

    @Column(name = "requires_manual_review", nullable = false)
    private boolean requiresManualReview = false;

    @Column(name = "reviewed", nullable = false)
    private boolean reviewed = false;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "reviewed_by")
    private Long reviewedBy;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public Long getId() { return id; }

    public Long getModelUserId() { return modelUserId; }
    public void setModelUserId(Long modelUserId) { this.modelUserId = modelUserId; }

    public int getStrikeCountAtBan() { return strikeCountAtBan; }
    public void setStrikeCountAtBan(int strikeCountAtBan) { this.strikeCountAtBan = strikeCountAtBan; }

    public LocalDateTime getBanStartedAt() { return banStartedAt; }

    public LocalDateTime getBanEndsAt() { return banEndsAt; }
    public void setBanEndsAt(LocalDateTime banEndsAt) { this.banEndsAt = banEndsAt; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public Long getSourceStrikeId() { return sourceStrikeId; }
    public void setSourceStrikeId(Long sourceStrikeId) { this.sourceStrikeId = sourceStrikeId; }

    public boolean isRequiresManualReview() { return requiresManualReview; }
    public void setRequiresManualReview(boolean requiresManualReview) { this.requiresManualReview = requiresManualReview; }

    public boolean isReviewed() { return reviewed; }
    public void setReviewed(boolean reviewed) { this.reviewed = reviewed; }

    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(LocalDateTime reviewedAt) { this.reviewedAt = reviewedAt; }

    public Long getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(Long reviewedBy) { this.reviewedBy = reviewedBy; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
