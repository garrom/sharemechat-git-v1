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

    // Campo payoutType retirado el 2026-07-24 junto con el resto del
    // programa de afiliadas ([ADR-052 §D11] + V38 drop columna
    // payout_requests.payout_type).

    /**
     * ADR-056 D12 (2026-07-29): rail multi-canal por el que se pagara la
     * solicitud. Denormalizado desde payout_methods.rail para reporting
     * eficiente sin JOIN. Valores validos (CHECK constraint en BD):
     * PAXUM | YOURSAFE | NOWPAYMENTS_CRYPTO | SEPA_MANUAL.
     * NULL en filas legacy pre-V42 (SEPA manual off-platform sin
     * seleccion explicita de rail).
     */
    @Column(name = "rail", length = 30)
    private String rail;

    /**
     * ADR-056 D12: FK opcional al PayoutMethod concreto de la fila
     * payout_methods elegido por el user. Se persiste como Long para
     * evitar dependencia ciclica entity <-> payout/entity; se resuelve
     * via PayoutMethodRepository cuando hace falta. NULL en filas
     * legacy pre-V42.
     */
    @Column(name = "payout_method_id")
    private Long payoutMethodId;

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

    public String getRail() { return rail; }
    public void setRail(String rail) { this.rail = rail; }

    public Long getPayoutMethodId() { return payoutMethodId; }
    public void setPayoutMethodId(Long payoutMethodId) { this.payoutMethodId = payoutMethodId; }
}