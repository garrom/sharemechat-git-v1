package com.sharemechat.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Host canonico del producto publico por entorno (ADR-015).
 *
 * Usado por la capa SEO del CMS (sitemap.xml, robots.txt, canonical,
 * Open Graph, JSON-LD) para construir URLs absolutas correctas en cada
 * entorno sin hardcodear hosts en el codigo.
 *
 * Mapeo: app.public.base-url -> baseUrl
 *  - TEST  -> https://test.sharemechat.com
 *  - AUDIT -> https://audit.sharemechat.com
 *  - PROD  -> https://sharemechat.com (cuando se monte)
 *
 * El valor llega desde application*.properties (con override por
 * APP_PUBLIC_BASE_URL si se quiere forzar en runtime).
 */
@Component
@ConfigurationProperties(prefix = "app.public")
public class PublicSiteProperties {

    /** URL absoluta del host canonico, sin barra final (p.ej. "https://test.sharemechat.com"). */
    private String baseUrl;

    public String getBaseUrl() { return baseUrl; }

    public void setBaseUrl(String baseUrl) {
        if (baseUrl == null) {
            this.baseUrl = null;
            return;
        }
        // Normalizar: quitar barra final para evitar "//blog/..." al concatenar paths
        String trimmed = baseUrl.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        this.baseUrl = trimmed;
    }
}
