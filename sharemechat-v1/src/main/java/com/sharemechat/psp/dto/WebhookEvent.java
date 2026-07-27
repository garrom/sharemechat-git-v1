package com.sharemechat.psp.dto;

import java.math.BigDecimal;

/**
 * ADR-051 D1: DTO vendor-agnostic resultado de parsear un webhook IPN.
 * El {@link com.sharemechat.psp.service.PaymentProvider} concreto
 * conoce el shape específico del vendor y lo normaliza a este objeto.
 *
 * <p>El {@code providerEventId} es el ID único emitido por el vendor.
 * Si el vendor NO envía un ID explícito, el provider deriva
 * {@code SHA-256(rawBody)} como sintético (patrón
 * {@code KycSessionService.processDiditWebhook:481-490}). El
 * orquestador usa este id para dedup en {@code psp_webhook_events}.
 *
 * <p>ADR-053 (2026-07-27): añadidos {@code payAmountCrypto} y
 * {@code actuallyPaidCrypto} para permitir tolerancia en pagos parciales
 * cripto (fluctuacion EUR/cripto entre creacion de invoice y
 * confirmacion del pago). Ambos son nullable: los providers que no los
 * emiten (o eventos no-pago) dejan null. El orquestador solo los
 * consulta en el flujo de partial_paid.
 */
public class WebhookEvent {

    private final String providerEventId;
    private final String providerPaymentId;
    private final String providerEventType;
    private final String orderId;
    private final PaymentStatus paymentStatus;
    /** Snapshot del status nativo del vendor (para persistir tal cual). */
    private final String rawPaymentStatus;
    /** Importe pedido en la moneda cripto del pago (ADR-053). Nullable. */
    private final BigDecimal payAmountCrypto;
    /** Importe realmente recibido en la moneda cripto del pago (ADR-053). Nullable. */
    private final BigDecimal actuallyPaidCrypto;

    public WebhookEvent(String providerEventId, String providerPaymentId,
                        String providerEventType, String orderId,
                        PaymentStatus paymentStatus, String rawPaymentStatus) {
        this(providerEventId, providerPaymentId, providerEventType, orderId,
                paymentStatus, rawPaymentStatus, null, null);
    }

    public WebhookEvent(String providerEventId, String providerPaymentId,
                        String providerEventType, String orderId,
                        PaymentStatus paymentStatus, String rawPaymentStatus,
                        BigDecimal payAmountCrypto, BigDecimal actuallyPaidCrypto) {
        this.providerEventId = providerEventId;
        this.providerPaymentId = providerPaymentId;
        this.providerEventType = providerEventType;
        this.orderId = orderId;
        this.paymentStatus = paymentStatus;
        this.rawPaymentStatus = rawPaymentStatus;
        this.payAmountCrypto = payAmountCrypto;
        this.actuallyPaidCrypto = actuallyPaidCrypto;
    }

    public String getProviderEventId() { return providerEventId; }
    public String getProviderPaymentId() { return providerPaymentId; }
    public String getProviderEventType() { return providerEventType; }
    public String getOrderId() { return orderId; }
    public PaymentStatus getPaymentStatus() { return paymentStatus; }
    public String getRawPaymentStatus() { return rawPaymentStatus; }
    public BigDecimal getPayAmountCrypto() { return payAmountCrypto; }
    public BigDecimal getActuallyPaidCrypto() { return actuallyPaidCrypto; }
}
