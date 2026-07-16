package com.sharemechat.psp.dto;

import java.math.BigDecimal;

/**
 * ADR-051 D1: DTO vendor-agnostic para crear un checkout hosted en el
 * PSP activo. El orquestador construye este objeto y lo pasa al
 * {@link com.sharemechat.psp.service.PaymentProvider} concreto.
 *
 * <p>Se corresponde con los parámetros comunes de NOWPayments Invoice
 * API (y compatible con Vendo/CommerceGate/RocketGate cuando se
 * integren).
 */
public class CreateInvoiceRequest {

    /**
     * ID único generado por nosotros (UUID puro por D5) y persistido en
     * {@code payment_sessions.order_id}. Enviado al vendor como
     * {@code order_id}.
     */
    private final String orderId;

    /** Descripción legible para el panel del vendor y el checkout (D6). */
    private final String orderDescription;

    /** Importe en EUR (moneda fiat de la plataforma). */
    private final BigDecimal priceAmount;

    /** Código ISO de moneda fiat ({@code "eur"} en nuestro caso). */
    private final String priceCurrency;

    /**
     * Moneda de pago del cliente (BTC, USDT, USDC, etc.) o {@code null}
     * si queremos que el vendor deje elegir al cliente en el hosted
     * checkout (D2 - preferido para máxima flexibilidad UX).
     */
    private final String payCurrency;

    /** URL absoluta de nuestro webhook IPN. */
    private final String ipnCallbackUrl;

    /** URL absoluta de vuelta tras pago OK (frontend). */
    private final String successUrl;

    /** URL absoluta de vuelta tras cancelación (frontend). */
    private final String cancelUrl;

    public CreateInvoiceRequest(String orderId, String orderDescription,
                                BigDecimal priceAmount, String priceCurrency, String payCurrency,
                                String ipnCallbackUrl, String successUrl, String cancelUrl) {
        this.orderId = orderId;
        this.orderDescription = orderDescription;
        this.priceAmount = priceAmount;
        this.priceCurrency = priceCurrency;
        this.payCurrency = payCurrency;
        this.ipnCallbackUrl = ipnCallbackUrl;
        this.successUrl = successUrl;
        this.cancelUrl = cancelUrl;
    }

    public String getOrderId() { return orderId; }
    public String getOrderDescription() { return orderDescription; }
    public BigDecimal getPriceAmount() { return priceAmount; }
    public String getPriceCurrency() { return priceCurrency; }
    public String getPayCurrency() { return payCurrency; }
    public String getIpnCallbackUrl() { return ipnCallbackUrl; }
    public String getSuccessUrl() { return successUrl; }
    public String getCancelUrl() { return cancelUrl; }
}
