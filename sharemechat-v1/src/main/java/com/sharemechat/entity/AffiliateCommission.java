package com.sharemechat.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * ADR-049 Subpasada 1: comision acumulada por evento de pago del cliente
 * atribuido.
 *
 * <p>Diseno on-demand (Actualizacion 2026-07-11 del ADR): al procesar el
 * {@code SUCCESS} de la {@link PaymentSession} del cliente atribuido, la
 * logica de comision consulta si la modelo referidora tiene alguna
 * facturacion propia en el mes calendario del cobro:
 * <ul>
 *   <li>si si, se crea la fila con {@code status='PAYABLE'};</li>
 *   <li>si no, se crea la fila con {@code status='SKIPPED_NO_ACTIVITY'}
 *       para trazabilidad, sin batch posterior.</li>
 * </ul>
 *
 * <p>Montos en centesimas de EUR ({@code base_amount_cents} y
 * {@code commission_amount_cents}) para calculos exactos y compatibilidad
 * con multi-moneda futura sin cambio de tipo. Rate en basis points
 * ({@code rate_bps}, 3000 = 30%).
 *
 * <p>Periodo {@code period_yyyymm} codifica el mes calendario del cobro
 * como INT (ej. 202607 = julio de 2026). Facilita indices y agregacion
 * por mes sin castings.
 *
 * <p>Estados posibles del campo {@code status}: {@code ACCRUED} (devengada
 * pendiente de evaluar umbral), {@code PAYABLE} (evaluada, cobrable),
 * {@code SKIPPED_NO_ACTIVITY} (evaluada, modelo sin actividad propia en el
 * mes), {@code REVERSED_CHARGEBACK} (fila de compensacion negativa por
 * chargeback/refund), {@code PAID} (pagada via {@code paidViaPayoutRequestId}).
 *
 * <p>Reversos por chargeback: el UNIQUE compuesto {@code (payment_session_id,
 * status)} permite dos filas por sesion de pago (por ejemplo {@code PAYABLE}
 * + {@code REVERSED_CHARGEBACK}), no UNIQUE simple sobre
 * {@code payment_session_id}.
 */
@Entity
@Table(name = "affiliate_commissions")
public class AffiliateCommission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "client_user_id", nullable = false)
    private Long clientUserId;

    @Column(name = "referrer_model_user_id", nullable = false)
    private Long referrerModelUserId;

    @Column(name = "payment_session_id", nullable = false)
    private Long paymentSessionId;

    /** Importe cobrado en centesimas de EUR. Base de calculo. */
    @Column(name = "base_amount_cents", nullable = false)
    private Long baseAmountCents;

    /** Rate en basis points. 3000 = 30%. */
    @Column(name = "rate_bps", nullable = false)
    private Integer rateBps = 3000;

    /**
     * Comision efectiva en centesimas de EUR.
     * Puede ser negativa cuando {@code status = REVERSED_CHARGEBACK}.
     */
    @Column(name = "commission_amount_cents", nullable = false)
    private Long commissionAmountCents;

    /** Anio*100 + mes calendario del cobro. Ej 202607. */
    @Column(name = "period_yyyymm", nullable = false)
    private Integer periodYyyymm;

    /** ACCRUED / PAYABLE / SKIPPED_NO_ACTIVITY / REVERSED_CHARGEBACK / PAID. */
    @Column(name = "status", nullable = false, length = 30)
    private String status;

    /** FK a {@code payout_requests.id} cuando la comision se paga. NULL antes. */
    @Column(name = "paid_via_payout_request_id")
    private Long paidViaPayoutRequestId;

    @Column(name = "created_at", nullable = false, updatable = false,
            columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false,
            columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    private LocalDateTime updatedAt;

    public AffiliateCommission() {
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }

    public Long getClientUserId() { return clientUserId; }
    public void setClientUserId(Long clientUserId) { this.clientUserId = clientUserId; }

    public Long getReferrerModelUserId() { return referrerModelUserId; }
    public void setReferrerModelUserId(Long referrerModelUserId) { this.referrerModelUserId = referrerModelUserId; }

    public Long getPaymentSessionId() { return paymentSessionId; }
    public void setPaymentSessionId(Long paymentSessionId) { this.paymentSessionId = paymentSessionId; }

    public Long getBaseAmountCents() { return baseAmountCents; }
    public void setBaseAmountCents(Long baseAmountCents) { this.baseAmountCents = baseAmountCents; }

    public Integer getRateBps() { return rateBps; }
    public void setRateBps(Integer rateBps) { this.rateBps = rateBps; }

    public Long getCommissionAmountCents() { return commissionAmountCents; }
    public void setCommissionAmountCents(Long commissionAmountCents) { this.commissionAmountCents = commissionAmountCents; }

    public Integer getPeriodYyyymm() { return periodYyyymm; }
    public void setPeriodYyyymm(Integer periodYyyymm) { this.periodYyyymm = periodYyyymm; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Long getPaidViaPayoutRequestId() { return paidViaPayoutRequestId; }
    public void setPaidViaPayoutRequestId(Long paidViaPayoutRequestId) { this.paidViaPayoutRequestId = paidViaPayoutRequestId; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
