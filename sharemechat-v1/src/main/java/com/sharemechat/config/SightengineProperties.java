package com.sharemechat.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuracion del adapter Sightengine para el pipeline de moderacion
 * visual del streaming (ADR-037: Sightengine como Plan A del frente
 * Moderacion IA; ver tambien ADR-030 build vs rent y ADR-036 postura
 * arquitectonica con captura cliente-side e image API frame-a-frame).
 *
 * <p>Mapea {@code moderation.sightengine.*} declarado en
 * {@code application.properties}. Vendor-agnostic en dominio: el nombre
 * Sightengine solo aparece en config y en {@code @ConfigurationProperties}
 * (regla {@code CLAUDE.md d8329b4}); el control plane usa la interface
 * agnostica {@code ModerationProviderClient}.
 *
 * <p>Modo MOCK: cuando {@code !enabled || apiUser blank || apiSecret
 * blank} el adapter Sightengine real (P2) debe caer al
 * {@code MockModerationClient} que devuelve verdicts GREEN deterministas,
 * mismo patron MOCK validado con Didit. En P1.2 NO existe adapter
 * Sightengine todavia; estas properties quedan declaradas pero solo se
 * consumiran cuando arranque P2.
 *
 * <p>Credenciales reales viajan via {@code config.env} runtime
 * (variables {@code MODERATION_SIGHTENGINE_*}, Spring relaxed binding),
 * NO al repo.
 */
@Component
@ConfigurationProperties(prefix = "moderation.sightengine")
public class SightengineProperties {

    private boolean enabled = false;
    private String baseUrl = "https://api.sightengine.com";
    private String apiUser;
    private String apiSecret;
    private String workflowId;
    private String webhookSecret;
    private String callbackUrl;

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

    public String getApiUser() {
        return apiUser;
    }

    public void setApiUser(String apiUser) {
        this.apiUser = apiUser;
    }

    public String getApiSecret() {
        return apiSecret;
    }

    public void setApiSecret(String apiSecret) {
        this.apiSecret = apiSecret;
    }

    public String getWorkflowId() {
        return workflowId;
    }

    public void setWorkflowId(String workflowId) {
        this.workflowId = workflowId;
    }

    public String getWebhookSecret() {
        return webhookSecret;
    }

    public void setWebhookSecret(String webhookSecret) {
        this.webhookSecret = webhookSecret;
    }

    public String getCallbackUrl() {
        return callbackUrl;
    }

    public void setCallbackUrl(String callbackUrl) {
        this.callbackUrl = callbackUrl;
    }
}
