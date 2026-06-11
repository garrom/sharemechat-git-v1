package com.sharemechat.content.publishing;

import com.sharemechat.config.PublicSiteProperties;
import com.sharemechat.content.entity.ContentArticleTranslation;
import com.sharemechat.content.service.ContentArticleService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Cobertura del endpoint /sitemap.xml tras Paso 4 SEO (2026-06-11):
 * - gate ADR-033 (belt-and-suspenders): solo apex PROD canonico responde
 *   200; cualquier otro entorno responde 404 (no expone URLs).
 * - PROD emite home apex (ES/EN) + 5 paginas estaticas de footer x 2 locales
 *   + las URLs del blog que ya cubria el paquete 5 (ADR-025).
 *
 * Para los casos no-PROD el servicio de articulos no se invoca (el gate
 * corta antes); se pasa null como en {@link SitemapControllerRobotsTest}.
 */
class SitemapControllerSitemapTest {

    private SitemapController controllerWithBaseUrl(String baseUrl, ContentArticleService svc) {
        PublicSiteProperties props = new PublicSiteProperties();
        props.setBaseUrl(baseUrl);
        return new SitemapController(svc, props);
    }

    @Test
    void testHostReturns404() {
        ResponseEntity<String> resp = controllerWithBaseUrl("https://test.sharemechat.com", null).sitemap();
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
    }

    @Test
    void auditHostReturns404() {
        ResponseEntity<String> resp = controllerWithBaseUrl("https://audit.sharemechat.com", null).sitemap();
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
    }

    @Test
    void wwwSubdomainReturns404() {
        ResponseEntity<String> resp = controllerWithBaseUrl("https://www.sharemechat.com", null).sitemap();
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
    }

    @Test
    void httpSchemeReturns404() {
        ResponseEntity<String> resp = controllerWithBaseUrl("http://sharemechat.com", null).sitemap();
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
    }

    @Test
    void emptyBaseUrlReturns404() {
        ResponseEntity<String> resp = controllerWithBaseUrl("", null).sitemap();
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
    }

    @Test
    void nullBaseUrlReturns404() {
        ResponseEntity<String> resp = controllerWithBaseUrl(null, null).sitemap();
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
    }

    @Test
    void prodApexEmitsHomeApexBothLocales() {
        ContentArticleService svc = mock(ContentArticleService.class);
        when(svc.listPublishedForSitemap()).thenReturn(List.of());
        ResponseEntity<String> resp =
                controllerWithBaseUrl("https://sharemechat.com", svc).sitemap();
        assertEquals(HttpStatus.OK, resp.getStatusCode());
        String body = resp.getBody();
        assertNotNull(body);
        // Home ES (apex raiz) y EN (/en/), con alternates cruzados.
        assertTrue(body.contains("<loc>https://sharemechat.com/</loc>"),
                "sitemap must include ES home apex");
        assertTrue(body.contains("<loc>https://sharemechat.com/en/</loc>"),
                "sitemap must include EN home (/en/)");
        // priority 1.0 en home.
        assertTrue(body.contains("<priority>1.0</priority>"),
                "home priority must be 1.0");
        // Alternates hreflang cruzados ES/EN sobre la home.
        assertTrue(body.contains(
                "<xhtml:link rel=\"alternate\" hreflang=\"es\" href=\"https://sharemechat.com/\"/>"));
        assertTrue(body.contains(
                "<xhtml:link rel=\"alternate\" hreflang=\"en\" href=\"https://sharemechat.com/en/\"/>"));
    }

    @Test
    void prodApexEmitsAllFiveFooterPagesBothLocales() {
        ContentArticleService svc = mock(ContentArticleService.class);
        when(svc.listPublishedForSitemap()).thenReturn(List.of());
        ResponseEntity<String> resp =
                controllerWithBaseUrl("https://sharemechat.com", svc).sitemap();
        String body = resp.getBody();
        assertNotNull(body);
        for (String path : new String[] {
                "/faq", "/safety", "/community-guidelines", "/cookies-settings", "/legal"
        }) {
            assertTrue(body.contains("<loc>https://sharemechat.com" + path + "</loc>"),
                    "sitemap must include ES " + path);
            assertTrue(body.contains("<loc>https://sharemechat.com/en" + path + "</loc>"),
                    "sitemap must include EN /en" + path);
            // Alternates cruzados por path.
            assertTrue(body.contains(
                    "<xhtml:link rel=\"alternate\" hreflang=\"es\" href=\"https://sharemechat.com"
                            + path + "\"/>"),
                    "alternate ES must point to " + path);
            assertTrue(body.contains(
                    "<xhtml:link rel=\"alternate\" hreflang=\"en\" href=\"https://sharemechat.com/en"
                            + path + "\"/>"),
                    "alternate EN must point to /en" + path);
        }
    }

    @Test
    void prodApexKeepsBlogIndexBothLocales() {
        // Regresion del paquete 5 (ADR-025): el sitemap sigue listando
        // /blog/es y /blog/en como entradas con alternates cruzados,
        // independientemente de si hay articulos publicados.
        ContentArticleService svc = mock(ContentArticleService.class);
        when(svc.listPublishedForSitemap()).thenReturn(List.of());
        ResponseEntity<String> resp =
                controllerWithBaseUrl("https://sharemechat.com", svc).sitemap();
        String body = resp.getBody();
        assertNotNull(body);
        assertTrue(body.contains("<loc>https://sharemechat.com/blog/es</loc>"),
                "blog ES home must remain in sitemap");
        assertTrue(body.contains("<loc>https://sharemechat.com/blog/en</loc>"),
                "blog EN home must remain in sitemap");
    }

    @Test
    void prodApexStillIncludesPublishedArticles() {
        // Regresion del paquete 5: los articulos publicados se siguen
        // emitiendo (UN <url> por (articulo, locale)). Modelamos un
        // articulo con dos traducciones ES/EN y verificamos ambos <loc>.
        ContentArticleTranslation esT = new ContentArticleTranslation();
        esT.setLocale("es");
        esT.setSlug("elegir-videochat-seguro");
        ContentArticleTranslation enT = new ContentArticleTranslation();
        enT.setLocale("en");
        enT.setSlug("how-to-choose-safe-video-chat");

        ContentArticleService.PublishedArticleSnapshot snap =
                new ContentArticleService.PublishedArticleSnapshot(
                        42L,
                        Instant.parse("2026-06-07T00:00:00Z"),
                        "https://assets.sharemechat.com/blog/elegir-videochat-seguro.webp",
                        List.of(esT, enT));

        ContentArticleService svc = mock(ContentArticleService.class);
        when(svc.listPublishedForSitemap()).thenReturn(List.of(snap));

        ResponseEntity<String> resp =
                controllerWithBaseUrl("https://sharemechat.com", svc).sitemap();
        String body = resp.getBody();
        assertNotNull(body);
        assertTrue(body.contains("<loc>https://sharemechat.com/blog/es/elegir-videochat-seguro</loc>"));
        assertTrue(body.contains("<loc>https://sharemechat.com/blog/en/how-to-choose-safe-video-chat</loc>"));
        assertTrue(body.contains("<lastmod>2026-06-07</lastmod>"));
        assertTrue(body.contains("<image:loc>https://assets.sharemechat.com/blog/elegir-videochat-seguro.webp</image:loc>"));
    }

    @Test
    void prodApexEmitsValidXmlStructure() {
        ContentArticleService svc = mock(ContentArticleService.class);
        when(svc.listPublishedForSitemap()).thenReturn(List.of());
        ResponseEntity<String> resp =
                controllerWithBaseUrl("https://sharemechat.com", svc).sitemap();
        String body = resp.getBody();
        assertNotNull(body);
        assertTrue(body.startsWith("<?xml version=\"1.0\" encoding=\"UTF-8\"?>"),
                "sitemap must start with XML declaration");
        assertTrue(body.contains("<urlset"), "sitemap must contain <urlset>");
        assertTrue(body.endsWith("</urlset>\n"), "sitemap must close <urlset>");
        assertTrue(body.contains("xmlns:xhtml=\"http://www.w3.org/1999/xhtml\""),
                "xhtml namespace required for hreflang alternates");
    }
}
