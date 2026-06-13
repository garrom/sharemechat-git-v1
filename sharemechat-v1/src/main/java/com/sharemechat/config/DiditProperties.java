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
 *  - {@link #workflowId} es nuevo respecto a Veriff: cada flujo (KYC modelo,
 *    Adaptive Age para cliente, etc.) tiene su propio workflow_id en el
 *    Workflow Builder de Didit. Esta property apunta al workflow del flujo
 *    de MODELO (Document+Selfie IDV). El flujo de cliente Age Estimation
 *    tendra su propia property cuando se implemente (frente separado).
 */
@Component
@ConfigurationProperties(prefix = "kyc.didit")
public class DiditProperties {

    private boolean enabled = false;
    private String baseUrl = "https://verification.didit.me";
    private String apiKey;
    private String apiSecret;
    private String callbackUrl;
    private String workflowId;
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

    public String getWorkflowId() {
        return workflowId;
    }

    public void setWorkflowId(String workflowId) {
        this.workflowId = workflowId;
    }

    public String getVendorDataPrefix() {
        return vendorDataPrefix;
    }

    public void setVendorDataPrefix(String vendorDataPrefix) {
        this.vendorDataPrefix = vendorDataPrefix;
    }
}
