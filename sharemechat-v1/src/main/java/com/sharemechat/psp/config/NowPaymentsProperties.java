package com.sharemechat.psp.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * ADR-051 D8: config del adapter NOWPayments (Fase 2).
 *
 * <p>Mapea {@code psp.nowpayments.*} declarado en
 * {@code application.properties}. En Fase 1 (schema + abstracción) las
 * credenciales aún NO se consumen; el adapter real se implementa en
 * Fase 2. Se declaran aquí para tener el binding listo desde el primer
 * commit.
 *
 * <p>Kill-switch DOBLE (D8): esta property + la fila
 * {@code psp_provider_config} runtime. Ambas deben ser TRUE/ENABLED
 * para que el vendor procese.
 */
@Component
@ConfigurationProperties(prefix = "psp.nowpayments")
public class NowPaymentsProperties {

    /**
     * Kill-switch por deploy. {@code false} default; se activa via env
     * {@code PSP_NOWPAYMENTS_ENABLED=true} cuando las credenciales están
     * en {@code secrets.env} y el adapter ha sido validado end-to-end.
     */
    private boolean enabled = false;

    /**
     * Base URL del vendor. Producción {@code https://api.nowpayments.io/v1/}
     * o sandbox {@code https://api-sandbox.nowpayments.io/v1/}.
     */
    private String baseUrl = "https://api.nowpayments.io/v1/";

    /** Credencial pública del API key (header {@code x-api-key}). */
    private String apiKey = "";

    /**
     * IPN secret usado para verificar la firma HMAC-SHA512 del webhook.
     * NUNCA se loggea ni se expone. Vive en {@code secrets.env}
     * (root:root 0600 tras la convergencia del 2026-07-15).
     */
    private String ipnSecret = "";

    /** URL absoluta de nuestro webhook IPN que registramos en el vendor. */
    private String ipnCallbackUrl = "";

    /** URL absoluta a la que redirige el hosted checkout tras pago OK. */
    private String successUrl = "";

    /** URL absoluta a la que redirige el hosted checkout tras cancel. */
    private String cancelUrl = "";

    /** Timeout de conexión al vendor (ms). */
    private int connectTimeoutMs = 5000;

    /** Timeout de lectura de respuesta del vendor (ms). */
    private int readTimeoutMs = 10000;

    /**
     * Si el adapter debe mandar el parametro {@code pay_currencies} al
     * crear invoice (whitelist de criptos por pack, ADR-051 Fase 5.1).
     * <p>PROD real acepta el parametro y filtra correctamente. **El
     * sandbox NOWPayments (2026-07-18) responde 400 INVALID_REQUEST_PARAMS
     * "pay_currencies is not allowed"**. Default {@code false} para que
     * TEST/AUDIT (sandbox) funcionen out-of-the-box; PROD lo activa en
     * su application-prod.properties.
     * <p>El orquestador sigue siempre calculando el filtro por pack y
     * ponendolo en el DTO {@link com.sharemechat.psp.dto.CreateInvoiceRequest};
     * es el adapter quien decide si mandarlo al vendor o no. Regla
     * vendor-agnostic intacta.
     */
    private boolean payCurrenciesEnabled = false;

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }

    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }

    public String getIpnSecret() { return ipnSecret; }
    public void setIpnSecret(String ipnSecret) { this.ipnSecret = ipnSecret; }

    public String getIpnCallbackUrl() { return ipnCallbackUrl; }
    public void setIpnCallbackUrl(String ipnCallbackUrl) { this.ipnCallbackUrl = ipnCallbackUrl; }

    public String getSuccessUrl() { return successUrl; }
    public void setSuccessUrl(String successUrl) { this.successUrl = successUrl; }

    public String getCancelUrl() { return cancelUrl; }
    public void setCancelUrl(String cancelUrl) { this.cancelUrl = cancelUrl; }

    public int getConnectTimeoutMs() { return connectTimeoutMs; }
    public void setConnectTimeoutMs(int connectTimeoutMs) { this.connectTimeoutMs = connectTimeoutMs; }

    public int getReadTimeoutMs() { return readTimeoutMs; }
    public void setReadTimeoutMs(int readTimeoutMs) { this.readTimeoutMs = readTimeoutMs; }

    public boolean isPayCurrenciesEnabled() { return payCurrenciesEnabled; }
    public void setPayCurrenciesEnabled(boolean payCurrenciesEnabled) { this.payCurrenciesEnabled = payCurrenciesEnabled; }
}
