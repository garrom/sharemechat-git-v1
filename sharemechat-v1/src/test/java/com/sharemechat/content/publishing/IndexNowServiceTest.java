package com.sharemechat.content.publishing;

import com.sharemechat.config.IndexNowProperties;
import com.sharemechat.config.PublicSiteProperties;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Cobertura de las guardas de {@link IndexNowService} (ADR-062).
 *
 * <p>Lo que se blinda aqui es la invariante numero 1 del ADR: <b>publicar un
 * articulo nunca puede fallar por IndexNow</b>. Cada caso comprueba que el
 * servicio se descarta solo, sin lanzar, cuando no se dan las condiciones.
 *
 * <p>Ninguno de estos tests hace red: o cortan antes de llegar al POST, o
 * apuntan a un endpoint mal formado que hace fallar al cliente HTTP en el
 * acto. Es deliberado — un test que dependa de alcanzar api.indexnow.org
 * seria flaky y no aportaria nada sobre la logica propia.
 */
class IndexNowServiceTest {

    private static final String KEY = "9bb7f3ea34ff3c920a64c259827b776d";
    private static final List<String> URLS = List.of("https://sharemechat.com/blog/es/articulo");

    private IndexNowService service(String baseUrl, String key, boolean enabled, String endpoint) {
        PublicSiteProperties site = new PublicSiteProperties();
        site.setBaseUrl(baseUrl);
        IndexNowProperties props = new IndexNowProperties();
        props.setKey(key);
        props.setEnabled(enabled);
        if (endpoint != null) props.setEndpoint(endpoint);
        return new IndexNowService(props, site);
    }

    /** Endpoint intencionadamente invalido: el POST falla sin tocar la red. */
    private IndexNowService serviceThatWillFailOnPost() {
        return service("https://sharemechat.com", KEY, true, "no-es-una-url");
    }

    @Test
    void disabledSkipsWithoutSending() {
        String out = service("https://sharemechat.com", KEY, false, null).submit(URLS);
        assertTrue(out.startsWith("omitido:"), out);
        assertTrue(out.contains("desactivada"), out);
    }

    @Test
    void nonProdApexSkips() {
        for (String baseUrl : new String[]{
                "https://test.sharemechat.com", "https://audit.sharemechat.com", "http://sharemechat.com"}) {
            String out = service(baseUrl, KEY, true, null).submit(URLS);
            assertTrue(out.startsWith("omitido:"), baseUrl + " -> " + out);
            assertTrue(out.contains("apex PROD"), out);
        }
    }

    @Test
    void missingOrMalformedKeySkips() {
        assertTrue(service("https://sharemechat.com", null, true, null).submit(URLS).contains("clave"));
        assertTrue(service("https://sharemechat.com", "corta", true, null).submit(URLS).contains("clave"));
    }

    @Test
    void emptyUrlListSkips() {
        assertTrue(service("https://sharemechat.com", KEY, true, null).submit(List.of()).startsWith("omitido:"));
        assertTrue(service("https://sharemechat.com", KEY, true, null).submit(null).startsWith("omitido:"));
    }

    @Test
    void urlsFromAnotherHostAreDiscardedBeforeSending() {
        // IndexNow responde 422 al lote COMPLETO si alguna URL no pertenece al
        // host declarado: una URL ajena colada echaria a perder el envio entero.
        // Aqui todas son ajenas, asi que debe omitir sin llamar.
        String out = service("https://sharemechat.com", KEY, true, null).submit(Arrays.asList(
                "https://otro-dominio.com/x",
                "https://test.sharemechat.com/blog/es/y",
                null,
                "   ",
                "no-es-una-url-absoluta"));
        assertTrue(out.startsWith("omitido:"), out);
        assertTrue(out.contains("ninguna URL valida"), out);
    }

    @Test
    void postFailureNeverPropagates() {
        // Invariante 1 del ADR-062: fail-open absoluto.
        IndexNowService s = serviceThatWillFailOnPost();
        assertDoesNotThrow(() -> s.submit(URLS));
        assertDoesNotThrow(() -> s.submitAsync(URLS));
        assertTrue(s.submit(URLS).startsWith("envio fallido"), "debe reportar el fallo sin lanzarlo");
    }
}
