package com.sharemechat.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuracion del cliente Didit (vendor unico Plan A, ADR-035).
 *
 * Mapea kyc.didit.* (env vars KYC_DIDIT_* via Spring relaxed binding).
 *
 * Divergencias respecto a {@link VeriffProperties} a tener presentes:
 *  - {@link #apiKey} viaja en la cabecera HTTP {@code x-api-key} (NO Bearer),
 *    y NO se firma el body de salida. La cabecera es el unico mecanismo de
 *    autenticacion del POST /v3/session/.
 *  - {@link #apiSecret} es el {@code secret_shared_key} del DESTINO de
 *    webhook (scoped por destino, NO igual al api-key). Solo se usa para
 *    VERIFICAR webhooks ENTRANTES via HMAC-SHA256 sobre el raw body. Si
 *    Didit rota la clave del destino, hay que actualizar esta property.
 *  - Workflow ids: cada flujo (KYC modelo, Age Estimation cliente) tiene
 *    su propio workflow_id en el Workflow Builder de Didit. El destino
 *    webhook es UNICO compartido entre ambos flujos (shareme-test-kyc),
 *    asi que el discriminador en el procesamiento del webhook es el
 *    workflow_id que viene en el payload + el session_type de la fila
 *    kyc_sessions.
 */
@Component
@ConfigurationProperties(prefix = "kyc.didit")
public class DiditProperties {

    private boolean enabled = false;
    private String baseUrl = "https://verification.didit.me";
    private String apiKey;
    private String apiSecret;
    // callbackUrl: legacy/shared. Si modelCallbackUrl o clientCallbackUrl
    // estan blank, se usa este como fallback. Cierra deuda P11 (registrada
    // al cierre del frente Email Gate + Age Verification, 2026-06-14):
    // antes el callback era unico para ambos flujos, lo que causaba que
    // tras el flujo modelo el navegador redirigiera a la pagina de
    // processing del cliente (filtros RequireRole + polling de campo
    // equivocado). Ahora cada flujo tiene su propio callback.
    private String callbackUrl;
    private String modelCallbackUrl;
    private String clientCallbackUrl;
    private String modelWorkflowId;
    private String clientWorkflowId;
    private String vendorDataPrefix = "smc";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public String getApiSecret() {
        return apiSecret;
    }

    public void setApiSecret(String apiSecret) {
        this.apiSecret = apiSecret;
    }

    public String getCallbackUrl() {
        return callbackUrl;
    }

    public void setCallbackUrl(String callbackUrl) {
        this.callbackUrl = callbackUrl;
    }

    public String getModelCallbackUrl() {
        return modelCallbackUrl;
    }

    public void setModelCallbackUrl(String modelCallbackUrl) {
        this.modelCallbackUrl = modelCallbackUrl;
    }

    public String getClientCallbackUrl() {
        return clientCallbackUrl;
    }

    public void setClientCallbackUrl(String clientCallbackUrl) {
        this.clientCallbackUrl = clientCallbackUrl;
    }

    /**
     * Callback URL efectivo para el flujo MODELO: si modelCallbackUrl esta
     * poblado, se usa; si no, fallback a callbackUrl (compat). Si ambos
     * estan blank, devuelve null y el caller decide (omite la clave
     * "callback" del payload).
     */
    public String getEffectiveModelCallbackUrl() {
        if (modelCallbackUrl != null && !modelCallbackUrl.isBlank()) {
            return modelCallbackUrl;
        }
        return callbackUrl;
    }

    /**
     * Callback URL efectivo para el flujo CLIENTE: si clientCallbackUrl esta
     * poblado, se usa; si no, fallback a callbackUrl (compat).
     */
    public String getEffectiveClientCallbackUrl() {
        if (clientCallbackUrl != null && !clientCallbackUrl.isBlank()) {
            return clientCallbackUrl;
        }
        return callbackUrl;
    }

    public String getModelWorkflowId() {
        return modelWorkflowId;
    }

    public void setModelWorkflowId(String modelWorkflowId) {
        this.modelWorkflowId = modelWorkflowId;
    }

    public String getClientWorkflowId() {
        return clientWorkflowId;
    }

    public void setClientWorkflowId(String clientWorkflowId) {
        this.clientWorkflowId = clientWorkflowId;
    }

    public String getVendorDataPrefix() {
        return vendorDataPrefix;
    }

    public void setVendorDataPrefix(String vendorDataPrefix) {
        this.vendorDataPrefix = vendorDataPrefix;
    }
}
