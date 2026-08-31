package com.sharemechat.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuracion del protocolo IndexNow (ADR-062).
 *
 * <p>IndexNow es un protocolo abierto de notificacion: en vez de esperar a
 * que el crawler pase, se le envia la lista de URLs nuevas o modificadas. Lo
 * consumen Bing, Yandex, Seznam y Naver desde un endpoint comun. Google NO lo
 * consume; para Google el canal sigue siendo el sitemap.
 *
 * <p><b>La clave no es un secreto.</b> Se publica deliberadamente en el
 * dominio ({@code https://host/<clave>.txt}) y su unica funcion es demostrar
 * que quien notifica controla el sitio. Puede aparecer en logs y en
 * {@code config.env} sin problema. Aun asi NO vive en el repositorio: es
 * configuracion por entorno, igual que las allowlists de pais.
 *
 * <p>Mapeo (todas resolubles por variable de entorno, ONE JAR):
 * <ul>
 *   <li>{@code seo.indexnow.enabled} -> {@code SEO_INDEXNOW_ENABLED}, default
 *       <b>false</b>. Apagado en los tres entornos hasta activarlo en el
 *       {@code config.env} de la caja correspondiente.</li>
 *   <li>{@code seo.indexnow.key} -> {@code SEO_INDEXNOW_KEY}, sin default.</li>
 *   <li>{@code seo.indexnow.endpoint} -> {@code SEO_INDEXNOW_ENDPOINT}.</li>
 * </ul>
 */
@Component
@ConfigurationProperties(prefix = "seo.indexnow")
public class IndexNowProperties {

    /** Formato exigido por el protocolo para la clave: 8-128 chars [a-zA-Z0-9-]. */
    public static final String KEY_PATTERN = "[a-zA-Z0-9-]{8,128}";

    private boolean enabled;
    private String key;
    private String endpoint = "https://api.indexnow.org/indexnow";
    private int connectTimeoutMs = 5000;
    private int readTimeoutMs = 10000;

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public String getKey() { return key; }
    public void setKey(String key) { this.key = key == null ? null : key.trim(); }

    public String getEndpoint() { return endpoint; }
    public void setEndpoint(String endpoint) { this.endpoint = endpoint; }

    public int getConnectTimeoutMs() { return connectTimeoutMs; }
    public void setConnectTimeoutMs(int v) { this.connectTimeoutMs = v; }

    public int getReadTimeoutMs() { return readTimeoutMs; }
    public void setReadTimeoutMs(int v) { this.readTimeoutMs = v; }

    /**
     * {@code true} si hay una clave presente y con el formato del protocolo.
     * Una clave mal formada se trata como ausente: enviarla produciria un 403
     * del servicio, asi que es preferible no llamar.
     */
    public boolean hasValidKey() {
        return key != null && key.matches(KEY_PATTERN);
    }
}
