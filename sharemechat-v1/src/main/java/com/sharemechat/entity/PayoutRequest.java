package com.sharemechat.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "payout_requests")
public class PayoutRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name="model_user_id", nullable=false)
    private Long modelUserId;

    @Column(nullable=false, precision=10, scale=2)
    private BigDecimal amount;

    @Column(nullable=false, length=10)
    private String currency = "EUR";

    @Column(nullable=false, length=20)
    private String status = "REQUESTED"; // REQUESTED | APPROVED | REJECTED | PAID | CANCELED

    @Column(length=255)
    private String reason;

    @Column(name="admin_notes", columnDefinition="text")
    private String adminNotes;

    @Column(name="reviewed_by_user_id")
    private Long reviewedByUserId;

    @Column(name="reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name="created_at", insertable=false, updatable=false)
    private LocalDateTime createdAt;

    @Column(name="updated_at", insertable=false, updatable=false)
    private LocalDateTime updatedAt;

    public PayoutRequest() {}

    public Long getId() { return id; }

    public Long getModelUserId() { return modelUserId; }
    public void setModelUserId(Long modelUserId) { this.modelUserId = modelUserId; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public String getAdminNotes() { return adminNotes; }
    public void setAdminNotes(String adminNotes) { this.adminNotes = adminNotes; }

    public Long getReviewedByUserId() { return reviewedByUserId; }
    public void setReviewedByUserId(Long reviewedByUserId) { this.reviewedByUserId = reviewedByUserId; }

    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(LocalDateTime reviewedAt) { this.reviewedAt = reviewedAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}