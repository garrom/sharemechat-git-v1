package com.sharemechat.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "model_review_checklist")
public class ModelReviewChecklist {
    @Id
    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "front_ok", nullable = false)
    private boolean frontOk = false;

    @Column(name = "back_ok", nullable = false)
    private boolean backOk = false;

    @Column(name = "selfie_ok", nullable = false)
    private boolean selfieOk = false;

    @Column(name = "last_reviewer_id")
    private Long lastReviewerId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }

    // getters & setters
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public boolean isFrontOk() { return frontOk; }
    public void setFrontOk(boolean frontOk) { this.frontOk = frontOk; }

    public boolean isBackOk() { return backOk; }
    public void setBackOk(boolean backOk) { this.backOk = backOk; }

    public boolean isSelfieOk() { return selfieOk; }
    public void setSelfieOk(boolean selfieOk) { this.selfieOk = selfieOk; }

    public Long getLastReviewerId() { return lastReviewerId; }
    public void setLastReviewerId(Long lastReviewerId) { this.lastReviewerId = lastReviewerId; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
