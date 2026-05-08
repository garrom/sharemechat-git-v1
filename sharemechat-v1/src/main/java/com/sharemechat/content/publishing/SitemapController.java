package com.sharemechat.content.publishing;

import com.sharemechat.config.PublicSiteProperties;
import com.sharemechat.content.constants.ContentConstants;
import com.sharemechat.content.entity.ContentArticle;
import com.sharemechat.content.repository.ContentArticleRepository;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * SEO layer del blog publico (Frente 2 sobre Fase 4A del CMS).
 *
 * Expone dos endpoints sin autenticacion:
 *  - GET /sitemap.xml  -> sitemap dinamico con todos los articulos PUBLISHED
 *  - GET /robots.txt   -> politica de crawling con sitemap absoluto
 *
 * Ambos endpoints construyen URLs absolutas a partir de
 * {@link PublicSiteProperties#getBaseUrl()} (resuelto por entorno via
 * application*.properties, ADR-015), evitando hardcodear hosts.
 */
@RestController
public class SitemapController {

    private static final DateTimeFormatter ISO_DATE = DateTimeFormatter.ISO_LOCAL_DATE;

    private final ContentArticleRepository articleRepo;
    private final PublicSiteProperties siteProperties;

    public SitemapController(ContentArticleRepository articleRepo,
                             PublicSiteProperties siteProperties) {
        this.articleRepo = articleRepo;
        this.siteProperties = siteProperties;
    }

    @GetMapping(value = "/sitemap.xml", produces = "application/xml; charset=UTF-8")
    public ResponseEntity<String> sitemap() {
        String baseUrl = resolveBaseUrl();

        List<ContentArticle> published = articleRepo
                .findByStateOrderByPublishedAtDesc(ContentConstants.STATE_PUBLISHED);

        StringBuilder sb = new StringBuilder(2048);
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");

        // Home del blog
        sb.append("  <url>\n");
        sb.append("    <loc>").append(escapeXml(baseUrl + "/blog")).append("</loc>\n");
        sb.append("    <changefreq>daily</changefreq>\n");
        sb.append("    <priority>0.8</priority>\n");
        sb.append("  </url>\n");

        // Articulos publicados
        for (ContentArticle a : published) {
            String slug = a.getSlug();
            if (slug == null || slug.isBlank()) continue;

            Instant lastmod = a.getUpdatedAt() != null ? a.getUpdatedAt() : a.getPublishedAt();
            sb.append("  <url>\n");
            sb.append("    <loc>")
                    .append(escapeXml(baseUrl + "/blog/" + slug))
                    .append("</loc>\n");
            if (lastmod != null) {
                sb.append("    <lastmod>")
                        .append(ISO_DATE.format(lastmod.atZone(ZoneOffset.UTC).toLocalDate()))
                        .append("</lastmod>\n");
            }
            sb.append("    <changefreq>weekly</changefreq>\n");
            sb.append("    <priority>0.7</priority>\n");
            sb.append("  </url>\n");
        }

        sb.append("</urlset>\n");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("application/xml; charset=UTF-8"));
        headers.setCacheControl("public, max-age=3600");
        return ResponseEntity.ok().headers(headers).body(sb.toString());
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
        // Fallback defensivo si la property no esta configurada en runtime.
        // En condiciones normales esto no se ejecuta porque application.properties
        // siempre fija un default (TEST).
        return "https://test.sharemechat.com";
    }

    private static String escapeXml(String s) {
        if (s == null) return "";
        return s
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }
}
