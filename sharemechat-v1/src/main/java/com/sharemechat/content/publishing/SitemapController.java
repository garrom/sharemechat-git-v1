package com.sharemechat.content.publishing;

import com.sharemechat.config.PublicSiteProperties;
import com.sharemechat.content.entity.ContentArticleTranslation;
import com.sharemechat.content.service.ContentArticleService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * SEO layer publico (sitemap + robots).
 *
 * Paquete 5 (ADR-025): /sitemap.xml emite UN <url> por (articulo, locale)
 * con `<xhtml:link rel="alternate" hreflang>` por cada locale alternativo
 * publicado del mismo articulo logico. Patron estandar Google para
 * sitemaps multilingues.
 *
 * Solo aparece contenido del blog (rutas publicas /blog/{locale}[/{slug}]).
 * Cache 1h (max-age=3600) acorde a la cadencia editorial de SharemeChat.
 *
 * /robots.txt: sin cambios desde paquete 1.
 */
@RestController
public class SitemapController {

    private static final DateTimeFormatter ISO_DATE = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final long SITEMAP_CACHE_SECONDS = 3600;

    private final ContentArticleService articleService;
    private final PublicSiteProperties siteProperties;

    public SitemapController(ContentArticleService articleService,
                             PublicSiteProperties siteProperties) {
        this.articleService = articleService;
        this.siteProperties = siteProperties;
    }

    @GetMapping(value = "/sitemap.xml", produces = "application/xml; charset=UTF-8")
    public ResponseEntity<String> sitemap() {
        String baseUrl = resolveBaseUrl();

        List<ContentArticleService.PublishedArticleSnapshot> published =
                articleService.listPublishedForSitemap();

        StringBuilder sb = new StringBuilder(4096);
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"\n");
        sb.append("        xmlns:xhtml=\"http://www.w3.org/1999/xhtml\"\n");
        sb.append("        xmlns:image=\"http://www.google.com/schemas/sitemap-image/1.1\">\n");

        // Home del blog por locale.
        appendUrl(sb, baseUrl + "/blog/es", null, "daily", "0.8", null,
                List.of(
                        new SitemapAlternate("es", baseUrl + "/blog/es"),
                        new SitemapAlternate("en", baseUrl + "/blog/en")
                ));
        appendUrl(sb, baseUrl + "/blog/en", null, "daily", "0.8", null,
                List.of(
                        new SitemapAlternate("es", baseUrl + "/blog/es"),
                        new SitemapAlternate("en", baseUrl + "/blog/en")
                ));

        // Articulos publicados: una <url> por (articulo, locale) con sus alternates.
        for (ContentArticleService.PublishedArticleSnapshot snap : published) {
            List<ContentArticleTranslation> trs = snap.translations();
            // Pre-construir la lista de alternates de este articulo (todos los
            // locales publicados con body).
            List<SitemapAlternate> articleAlternates = trs.stream()
                    .map(t -> new SitemapAlternate(
                            t.getLocale(),
                            baseUrl + "/blog/" + t.getLocale() + "/" + t.getSlug()))
                    .toList();

            for (ContentArticleTranslation t : trs) {
                String loc = baseUrl + "/blog/" + t.getLocale() + "/" + t.getSlug();
                String lastMod = snap.lastModified() == null
                        ? null
                        : ISO_DATE.format(snap.lastModified().atZone(ZoneOffset.UTC).toLocalDate());
                appendUrl(sb, loc, lastMod, "weekly", "0.7",
                        snap.heroImageUrl(),
                        articleAlternates);
            }
        }

        sb.append("</urlset>\n");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("application/xml; charset=UTF-8"));
        headers.setCacheControl("public, max-age=" + SITEMAP_CACHE_SECONDS);
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

    // ================================================================
    // Helpers
    // ================================================================

    private void appendUrl(StringBuilder sb,
                           String loc,
                           String lastMod,
                           String changefreq,
                           String priority,
                           String imageUrl,
                           List<SitemapAlternate> alternates) {
        sb.append("  <url>\n");
        sb.append("    <loc>").append(escapeXml(loc)).append("</loc>\n");
        if (lastMod != null) {
            sb.append("    <lastmod>").append(lastMod).append("</lastmod>\n");
        }
        if (changefreq != null) {
            sb.append("    <changefreq>").append(changefreq).append("</changefreq>\n");
        }
        if (priority != null) {
            sb.append("    <priority>").append(priority).append("</priority>\n");
        }
        if (alternates != null) {
            for (SitemapAlternate alt : alternates) {
                sb.append("    <xhtml:link rel=\"alternate\" hreflang=\"")
                        .append(alt.locale())
                        .append("\" href=\"")
                        .append(escapeXml(alt.url()))
                        .append("\"/>\n");
            }
        }
        if (imageUrl != null && !imageUrl.isBlank()
                && (imageUrl.startsWith("http://") || imageUrl.startsWith("https://"))) {
            sb.append("    <image:image>\n");
            sb.append("      <image:loc>").append(escapeXml(imageUrl)).append("</image:loc>\n");
            sb.append("    </image:image>\n");
        }
        sb.append("  </url>\n");
    }

    private String resolveBaseUrl() {
        String configured = siteProperties == null ? null : siteProperties.getBaseUrl();
        if (configured != null && !configured.isBlank()) return configured;
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

    /** Tupla interna para construir bloques `<xhtml:link>` por locale. */
    private record SitemapAlternate(String locale, String url) {}
}
