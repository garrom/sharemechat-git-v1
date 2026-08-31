package com.sharemechat.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.net.URI;

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

    /**
     * Host canonico del apex PROD (ADR-015). Discriminante unico de "este
     * entorno es el sitio publico real" para toda la capa SEO.
     */
    public static final String PROD_APEX_HOST = "sharemechat.com";

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

    /**
     * {@code true} solo si el {@code baseUrl} configurado es EXACTAMENTE el
     * apex PROD canonico: esquema https, host {@value #PROD_APEX_HOST} y
     * puerto por defecto. Cualquier otra cosa (TEST, AUDIT, www, host
     * desconocido, vacio, mal formado) devuelve {@code false}.
     *
     * <p>Es el discriminante fail-closed de ADR-033: la capa SEO publica
     * ({@code /robots.txt}, {@code /sitemap.xml}, fichero de clave IndexNow
     * de ADR-062) solo se expone en el sitio publico real. Un entorno
     * secundario nunca debe ofrecer URLs canonicas ni pedir que le rastreen.
     *
     * <p>Vive aqui, y no en cada controller, para que exista UNA sola
     * definicion de "soy el apex PROD": duplicarla en cada consumidor es la
     * via directa a que un entorno quede indexable por olvido.
     */
    public boolean isProdApex() {
        if (baseUrl == null || baseUrl.isBlank()) {
            return false;
        }
        try {
            URI uri = URI.create(baseUrl);
            if (!"https".equalsIgnoreCase(uri.getScheme())) {
                return false;
            }
            String host = uri.getHost();
            if (host == null || !PROD_APEX_HOST.equalsIgnoreCase(host)) {
                return false;
            }
            int port = uri.getPort();
            return port == -1 || port == 443;
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }
}
