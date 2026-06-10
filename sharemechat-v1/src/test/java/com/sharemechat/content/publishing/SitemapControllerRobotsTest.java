package com.sharemechat.content.publishing;

import com.sharemechat.config.PublicSiteProperties;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Cobertura del discriminante ADR-033 sobre robots.txt: fail-closed por
 * entorno. Solo el apex PROD canonico (https + sharemechat.com exacto,
 * puerto default) recibe robots indexable; cualquier otra config
 * responde Disallow:/.
 *
 * El servicio de articulos es null porque robots() no lo invoca; el
 * constructor lo acepta y el test ejercita exclusivamente la ruta de
 * decision de indexabilidad.
 */
class SitemapControllerRobotsTest {

    private static final String DISALLOW_ALL = "User-agent: *\nDisallow: /\n";

    private SitemapController controllerWithBaseUrl(String baseUrl) {
        PublicSiteProperties props = new PublicSiteProperties();
        props.setBaseUrl(baseUrl);
        return new SitemapController(null, props);
    }

    @Test
    void prodApexEmitsIndexableRobots() {
        ResponseEntity<String> resp = controllerWithBaseUrl("https://sharemechat.com").robots();
        String body = resp.getBody();
        assertNotNull(body);
        assertTrue(body.contains("Allow: /blog"), "PROD apex must allow /blog");
        assertTrue(body.contains("Disallow: /api/"), "PROD apex must keep /api/ disallowed");
        assertTrue(body.contains("Sitemap: https://sharemechat.com/sitemap.xml"),
                "PROD apex must emit Sitemap line with PROD base URL");
    }

    @Test
    void prodApexWithTrailingSlashStillIndexable() {
        ResponseEntity<String> resp = controllerWithBaseUrl("https://sharemechat.com/").robots();
        assertTrue(resp.getBody().contains("Sitemap: https://sharemechat.com/sitemap.xml"));
    }

    @Test
    void testHostFailsClosed() {
        ResponseEntity<String> resp = controllerWithBaseUrl("https://test.sharemechat.com").robots();
        assertEquals(DISALLOW_ALL, resp.getBody());
    }

    @Test
    void auditHostFailsClosed() {
        ResponseEntity<String> resp = controllerWithBaseUrl("https://audit.sharemechat.com").robots();
        assertEquals(DISALLOW_ALL, resp.getBody());
    }

    @Test
    void wwwSubdomainFailsClosed() {
        // ADR-015: www no es canonico; redirige 301 al apex en CloudFront.
        // El backend nunca deberia tener baseUrl con www, pero si lo tuviera, fail-closed.
        ResponseEntity<String> resp = controllerWithBaseUrl("https://www.sharemechat.com").robots();
        assertEquals(DISALLOW_ALL, resp.getBody());
    }

    @Test
    void httpSchemeFailsClosed() {
        // PROD canonico es https-only. http significa entorno mal configurado.
        ResponseEntity<String> resp = controllerWithBaseUrl("http://sharemechat.com").robots();
        assertEquals(DISALLOW_ALL, resp.getBody());
    }

    @Test
    void unknownHostFailsClosed() {
        ResponseEntity<String> resp = controllerWithBaseUrl("https://malicious.example.com").robots();
        assertEquals(DISALLOW_ALL, resp.getBody());
    }

    @Test
    void emptyBaseUrlFailsClosed() {
        ResponseEntity<String> resp = controllerWithBaseUrl("").robots();
        assertEquals(DISALLOW_ALL, resp.getBody());
    }

    @Test
    void nullBaseUrlFailsClosed() {
        ResponseEntity<String> resp = controllerWithBaseUrl(null).robots();
        assertEquals(DISALLOW_ALL, resp.getBody());
    }

    @Test
    void malformedBaseUrlFailsClosed() {
        ResponseEntity<String> resp = controllerWithBaseUrl("not a url at all").robots();
        assertEquals(DISALLOW_ALL, resp.getBody());
    }

    @Test
    void customPortFailsClosed() {
        // Puerto no estandar implica entorno no productivo (dev/staging local).
        ResponseEntity<String> resp = controllerWithBaseUrl("https://sharemechat.com:8443").robots();
        assertEquals(DISALLOW_ALL, resp.getBody());
    }
}
