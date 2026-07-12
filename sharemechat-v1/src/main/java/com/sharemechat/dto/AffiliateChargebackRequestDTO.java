package com.sharemechat.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * ADR-049 D8 + Subpasada 5 (revisada 2026-07-12): request del endpoint
 * admin {@code POST /api/admin/affiliate/chargeback}.
 *
 * <p>Se usara cuando entre NOWPayments (siguiente frente) o PSP tarjeta
 * futuro y aparezca un chargeback/refund sobre una PaymentSession que ya
 * habia devengado comision de afiliada.
 *
 * <p>En fase actual (D2 revisado, trigger STREAM_CHARGE) no hay comisiones
 * sobre PaymentSession; el endpoint queda listo para el futuro.
 */
public class AffiliateChargebackRequestDTO {

    @NotNull
    private Long paymentSessionId;

    /** Importe reembolsado al cliente en centesimas de EUR. Positivo. */
    @NotNull
    @Positive
    private Long refundedAmountCents;

    /** Motivo del chargeback (chargeback tarjeta, refund manual, fraude, etc.). */
    private String reason;

    public Long getPaymentSessionId() { return paymentSessionId; }
    public void setPaymentSessionId(Long paymentSessionId) { this.paymentSessionId = paymentSessionId; }

    public Long getRefundedAmountCents() { return refundedAmountCents; }
    public void setRefundedAmountCents(Long refundedAmountCents) { this.refundedAmountCents = refundedAmountCents; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
