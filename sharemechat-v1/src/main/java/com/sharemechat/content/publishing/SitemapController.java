package com.sharemechat.content.publishing;

import com.sharemechat.config.PublicSiteProperties;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * SEO layer publico (sitemap + robots).
 *
 * --------------------------------------------------------------------
 * PAQUETE 1 (ADR-025): /sitemap.xml NEUTRALIZADO.
 *
 * El sitemap requiere consulta sobre el modelo nuevo (article logico
 * + translations) y emision de xhtml:link multilingue. Se reescribe
 * en paquete 5 (SEO multilingue, cierre de ADR-022 fase 4E).
 *
 * /robots.txt se mantiene operativo: no depende del modelo CMS y
 * sigue siendo util para crawlers durante la ventana de rediseno.
 * --------------------------------------------------------------------
 */
@RestController
public class SitemapController {

    private static final String MSG =
            "Pendiente paquete 5 — rediseño CMS bilingüe (ADR-025)";

    private final PublicSiteProperties siteProperties;

    public SitemapController(PublicSiteProperties siteProperties) {
        this.siteProperties = siteProperties;
    }

    @GetMapping(value = "/sitemap.xml", produces = "application/xml; charset=UTF-8")
    public ResponseEntity<String> sitemap() {
        throw new UnsupportedOperationException(MSG);
    }

    @GetMapping(value = "/robots.txt", produces = "text/plain; charset=UTF-8")
    public ResponseEntity<String> robots() {
        String baseUrl = resolveBaseUrl();

        String body = ""
                + "User-agent: *\n"
                + "Allow: /blog\n"
                + "Allow: /blog/\n"
                + "\n"
                + "Disallow: /api/\n"
                + "Disallow: /admin\n"
                + "Disallow: /dashboard\n"
                + "Disallow: /login\n"
                + "Disallow: /register\n"
                + "\n"
                + "Sitemap: " + baseUrl + "/sitemap.xml\n";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/plain; charset=UTF-8"));
        headers.setCacheControl("public, max-age=86400");
        return ResponseEntity.ok().headers(headers).body(body);
    }

    private String resolveBaseUrl() {
        String configured = siteProperties.getBaseUrl();
        if (configured != null && !configured.isBlank()) {
            return configured;
        }
        return "https://test.sharemechat.com";
    }
}
