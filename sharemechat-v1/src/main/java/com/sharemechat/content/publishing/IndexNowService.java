package com.sharemechat.content.publishing;

import com.sharemechat.config.IndexNowProperties;
import com.sharemechat.config.PublicSiteProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

/**
 * Notificacion activa de URLs a IndexNow (ADR-062).
 *
 * <p>Unico punto del paquete {@code content} que habla con un servicio
 * externo. El aislamiento es deliberado: el resto del paquete sigue sin
 * conocer red saliente.
 *
 * <h3>Invariantes (ADR-062) — no negociables</h3>
 * <ol>
 *   <li><b>Fail-open absoluto.</b> Publicar un articulo NUNCA puede fallar
 *       por IndexNow. Toda excepcion se registra y se descarta; este servicio
 *       jamas propaga. Es un efecto secundario, no parte de la transaccion.</li>
 *   <li><b>Solo el apex PROD notifica.</b> Coherente con el fail-closed de
 *       ADR-033: si TEST y AUDIT no deben indexarse, menos aun pedir que les
 *       rastreen.</li>
 *   <li><b>Apagado por defecto.</b> ONE JAR: el binario es identico en los
 *       tres entornos; la activacion vive en el {@code config.env} de cada
 *       caja.</li>
 *   <li><b>La clave es configuracion, no codigo.</b> Llega por property.</li>
 * </ol>
 *
 * <p>Ejecucion {@code @Async}: la llamada saliente ocurre en un flujo de
 * escritura (transicion a PUBLISHED) y no debe anadir latencia ni riesgo al
 * commit. El volumen editorial real (~4 articulos/mes) no justifica un
 * executor dedicado como el de moderacion; basta el pool por defecto.
 *
 * <p>Codigos del protocolo: 200 OK, 202 aceptado con clave pendiente de
 * validar, 400 payload invalido, 403 clave no valida, 422 URLs ajenas al host
 * o clave que no casa, 429 exceso de envios.
 */
@Service
public class IndexNowService {

    private static final Logger log = LoggerFactory.getLogger(IndexNowService.class);
    private static final String LOG_PREFIX = "[INDEXNOW]";

    /** Limite del protocolo por envio. */
    private static final int MAX_URLS_PER_BATCH = 10000;

    private final IndexNowProperties props;
    private final PublicSiteProperties siteProperties;
    private final RestTemplate restTemplate;

    public IndexNowService(IndexNowProperties props, PublicSiteProperties siteProperties) {
        this.props = props;
        this.siteProperties = siteProperties;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(props.getConnectTimeoutMs());
        factory.setReadTimeout(props.getReadTimeoutMs());
        this.restTemplate = new RestTemplate(factory);
    }

    /**
     * Envia las URLs indicadas. Asincrono y fail-open: no lanza nunca.
     *
     * <p>Descarta en silencio si la capa esta apagada, si el entorno no es el
     * apex PROD, si falta clave valida o si no queda ninguna URL util. Esos
     * casos son operacion normal, no error.
     */
    @Async
    public void submitAsync(List<String> urls) {
        try {
            submit(urls);
        } catch (Exception ex) {
            // Cinturon final: @Async ya aisla del llamante, pero dejar escapar
            // una excepcion aqui solo ensucia el log del executor.
            log.warn("{} envio descartado por excepcion inesperada: {}", LOG_PREFIX, ex.toString());
        }
    }

    /**
     * Version sincrona, para el endpoint admin de reenvio masivo, donde el
     * operador si quiere ver el resultado.
     *
     * @return resumen legible del intento; nunca lanza.
     */
    public String submit(List<String> urls) {
        if (!props.isEnabled()) {
            return skip("capa desactivada (seo.indexnow.enabled=false)");
        }
        if (!siteProperties.isProdApex()) {
            return skip("el entorno no es el apex PROD canonico");
        }
        if (!props.hasValidKey()) {
            return skip("sin clave valida configurada (seo.indexnow.key)");
        }
        if (urls == null || urls.isEmpty()) {
            return skip("lista de URLs vacia");
        }

        String baseUrl = siteProperties.getBaseUrl();
        String host = URI.create(baseUrl).getHost();

        // IndexNow rechaza el lote COMPLETO (422) si alguna URL no pertenece
        // al host declarado. Filtrar aqui evita perder el envio entero por una
        // URL mal formada. LinkedHashSet ademas deduplica preservando orden.
        LinkedHashSet<String> clean = new LinkedHashSet<>();
        int discarded = 0;
        for (String u : urls) {
            if (u == null || u.isBlank()) { discarded++; continue; }
            try {
                if (host.equalsIgnoreCase(URI.create(u.trim()).getHost())) {
                    clean.add(u.trim());
                } else {
                    discarded++;
                }
            } catch (IllegalArgumentException ex) {
                discarded++;
            }
        }
        if (clean.isEmpty()) {
            return skip("ninguna URL valida para el host " + host + " (descartadas " + discarded + ")");
        }
        if (clean.size() > MAX_URLS_PER_BATCH) {
            return skip("lote de " + clean.size() + " excede el limite del protocolo (" + MAX_URLS_PER_BATCH + ")");
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("host", host);
        body.put("key", props.getKey());
        body.put("keyLocation", baseUrl + "/" + props.getKey() + ".txt");
        body.put("urlList", List.copyOf(clean));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        try {
            ResponseEntity<String> resp = restTemplate.postForEntity(
                    props.getEndpoint(), new HttpEntity<>(body, headers), String.class);
            int code = resp.getStatusCode().value();
            String msg = "enviadas " + clean.size() + " URL(s), HTTP " + code
                    + (discarded > 0 ? " (descartadas " + discarded + ")" : "");
            if (code == 200 || code == 202) {
                log.info("{} {}", LOG_PREFIX, msg);
            } else {
                log.warn("{} respuesta inesperada: {}", LOG_PREFIX, msg);
            }
            return msg;
        } catch (Exception ex) {
            // Fail-open: se registra y se sigue. Un buscador caido no puede
            // impedir que se publique contenido.
            String msg = "envio fallido (" + clean.size() + " URLs): " + ex.getMessage();
            log.warn("{} {}", LOG_PREFIX, msg);
            return msg;
        }
    }

    private String skip(String reason) {
        log.debug("{} envio omitido: {}", LOG_PREFIX, reason);
        return "omitido: " + reason;
    }
}
