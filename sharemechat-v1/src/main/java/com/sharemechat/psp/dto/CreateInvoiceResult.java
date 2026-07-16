package com.sharemechat.psp.dto;

/**
 * ADR-051 D1: DTO vendor-agnostic resultado de crear un checkout.
 * El orquestador persiste el {@code providerPaymentId} en
 * {@code payment_sessions.psp_transaction_id} y devuelve la
 * {@code invoiceUrl} al frontend para el redirect al hosted checkout.
 */
public class CreateInvoiceResult {

    /** ID único del invoice/payment en el vendor (NOWPayments: id numérico). */
    private final String providerPaymentId;

    /** URL absoluta del hosted checkout. Frontend hace redirect aquí. */
    private final String invoiceUrl;

    public CreateInvoiceResult(String providerPaymentId, String invoiceUrl) {
        this.providerPaymentId = providerPaymentId;
        this.invoiceUrl = invoiceUrl;
    }

    public String getProviderPaymentId() { return providerPaymentId; }
    public String getInvoiceUrl() { return invoiceUrl; }
}
