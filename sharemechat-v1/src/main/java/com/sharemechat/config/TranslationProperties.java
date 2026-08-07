package com.sharemechat.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * pending-hardening §5.3 (2026-08-08): configuracion del proveedor de
 * traduccion automatica para chat P2P cross-language.
 *
 * Mapea translation.google.* (env vars TRANSLATION_GOOGLE_* via Spring
 * relaxed binding). Provider por defecto: Google Cloud Translation v2 (API
 * key based; 500K chars/mes gratis sin caducidad).
 *
 * Modo degradado: si {@link #enabled} es false o {@link #apiKey} esta blank,
 * el adapter lanza {@code TranslationUnavailableException} y el servicio
 * caller devuelve 503 al frontend. El frontend oculta el toggle de
 * traduccion mientras esta en ese estado. Esto permite desarrollar,
 * desplegar y arrancar TEST/AUDIT/PROD sin credenciales configuradas.
 */
@Component
@ConfigurationProperties(prefix = "translation.google")
public class TranslationProperties {

    private boolean enabled = false;
    private String apiKey;
    private String endpoint = "https://translation.googleapis.com/language/translate/v2";
    private int timeoutMs = 5000;

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }

    public String getEndpoint() { return endpoint; }
    public void setEndpoint(String endpoint) { this.endpoint = endpoint; }

    public int getTimeoutMs() { return timeoutMs; }
    public void setTimeoutMs(int timeoutMs) { this.timeoutMs = timeoutMs; }

    public boolean isConfigured() {
        return enabled && apiKey != null && !apiKey.isBlank();
    }
}
