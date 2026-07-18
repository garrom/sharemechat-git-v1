package com.sharemechat.psp.dto;

import java.math.BigDecimal;
import java.util.List;

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

    /**
     * ADR-051 Fase 5 (2026-07-18): lista blanca de criptomonedas
     * permitidas para ESTE pago concreto. NOWPayments filtra el
     * selector del hosted checkout a las monedas de esta lista
     * (parametro {@code pay_currencies} de POST /v1/invoice). Se usa
     * para evitar que el cliente elija una moneda cuyo minimo
     * exceda el precio del pack (p.ej. BTC no cabe en P10 = 10 EUR
     * porque BTC minimo ronda 12-30 EUR segun cambio del momento).
     * <p>{@code null} o lista vacia significa "el vendor deja elegir
     * cualquiera de las activas en el panel" (comportamiento
     * previo, ahora reservado para packs grandes o testing).
     */
    private final List<String> payCurrencies;

    /** URL absoluta de nuestro webhook IPN. */
    private final String ipnCallbackUrl;

    /** URL absoluta de vuelta tras pago OK (frontend). */
    private final String successUrl;

    /** URL absoluta de vuelta tras cancelación (frontend). */
    private final String cancelUrl;

    public CreateInvoiceRequest(String orderId, String orderDescription,
                                BigDecimal priceAmount, String priceCurrency, String payCurrency,
                                List<String> payCurrencies,
                                String ipnCallbackUrl, String successUrl, String cancelUrl) {
        this.orderId = orderId;
        this.orderDescription = orderDescription;
        this.priceAmount = priceAmount;
        this.priceCurrency = priceCurrency;
        this.payCurrency = payCurrency;
        this.payCurrencies = payCurrencies;
        this.ipnCallbackUrl = ipnCallbackUrl;
        this.successUrl = successUrl;
        this.cancelUrl = cancelUrl;
    }

    public String getOrderId() { return orderId; }
    public String getOrderDescription() { return orderDescription; }
    public BigDecimal getPriceAmount() { return priceAmount; }
    public String getPriceCurrency() { return priceCurrency; }
    public String getPayCurrency() { return payCurrency; }
    public List<String> getPayCurrencies() { return payCurrencies; }
    public String getIpnCallbackUrl() { return ipnCallbackUrl; }
    public String getSuccessUrl() { return successUrl; }
    public String getCancelUrl() { return cancelUrl; }
}
