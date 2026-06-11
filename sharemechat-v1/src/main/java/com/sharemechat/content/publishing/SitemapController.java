package com.sharemechat.content.publishing;

import com.sharemechat.config.PublicSiteProperties;
import com.sharemechat.content.entity.ContentArticleTranslation;
import com.sharemechat.content.service.ContentArticleService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
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
 * Paso 4 SEO (2026-06-11): /sitemap.xml extendido para incluir home y
 * paginas de footer (/faq, /safety, /community-guidelines,
 * /cookies-settings, /legal), con alternates ES/EN segun el patron de
 * basename del SPA producto (ES en raiz, EN bajo `/en`).
 *
 * Cache 1h (max-age=3600) acorde a la cadencia editorial de SharemeChat.
 *
 * /robots.txt (ADR-033, 2026-06-10): fail-closed por entorno. Solo el
 * apex PROD canonico (host exacto `sharemechat.com`, esquema https, sin
 * puerto custom) recibe el robots indexable. Cualquier otro baseUrl
 * (TEST, AUDIT, www, host desconocido, vacio, mal formado) responde
 * `User-agent: * / Disallow: /` sin linea Sitemap. Sustituye al canonical
 * hardcoded del index.html que hasta hoy reconducia accidentalmente
 * trafico de no-PROD a PROD. Detalle en ADR-033.
 *
 * Paso 4 SEO (2026-06-11): /sitemap.xml tambien queda gateado por el
 * mismo discriminante isProdApex() (belt-and-suspenders): solo el apex
 * PROD canonico sirve el XML; cualquier otro entorno responde 404. El
 * robots de no-PROD ya impide la indexacion, pero al no exponer ni el
 * propio sitemap se elimina cualquier ventana donde un crawler curioso
 * descubra URLs canonicas a traves de un entorno secundario.
 */
@RestController
public class SitemapController {

    private static final DateTimeFormatter ISO_DATE = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final long SITEMAP_CACHE_SECONDS = 3600;

    /** Host canonico del apex PROD (ADR-015). Discriminante de robots.txt. */
    private static final String PROD_APEX_HOST = "sharemechat.com";

    /** Body fail-closed de robots.txt para entornos no indexables. */
    private static final String ROBOTS_DISALLOW_ALL = "User-agent: *\nDisallow: /\n";

    /**
     * Paginas estaticas publicas del SPA producto a incluir en el sitemap,
     * fuera del blog. Cada path se emite con dos `<url>` (uno por locale)
     * y alternates hreflang ES/EN apuntando a la variante del otro locale.
     *
     * ES vive en raiz (basename "/"), EN bajo "/en" (App.jsx:77
     * `localeBasename = matchesEn ? '/en' : '/'`). Confirmado contra el
     * routing real el 2026-06-11.
     */
    private static final List<String> STATIC_PUBLIC_PATHS = List.of(
            "/faq",
            "/safety",
            "/community-guidelines",
            "/cookies-settings",
            "/legal"
    );

    private final ContentArticleService articleService;
    private final PublicSiteProperties siteProperties;

    public SitemapController(ContentArticleService articleService,
                             PublicSiteProperties siteProperties) {
        this.articleService = articleService;
        this.siteProperties = siteProperties;
    }

    @GetMapping(value = "/sitemap.xml", produces = "application/xml; charset=UTF-8")
    public ResponseEntity<String> sitemap() {
        // Paso 4 SEO (2026-06-11): belt-and-suspenders ADR-033. Solo el apex
        // PROD canonico sirve sitemap; el resto devuelve 404 (no expone URLs).
        if (!isProdApex()) {
            return ResponseEntity.notFound().build();
        }

        String baseUrl = resolveBaseUrl();

        List<ContentArticleService.PublishedArticleSnapshot> published =
                articleService.listPublishedForSitemap();

        StringBuilder sb = new StringBuilder(4096);
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"\n");
        sb.append("        xmlns:xhtml=\"http://www.w3.org/1999/xhtml\"\n");
        sb.append("        xmlns:image=\"http://www.google.com/schemas/sitemap-image/1.1\">\n");

        // Home apex por locale (ES en raiz, EN bajo /en).
        List<SitemapAlternate> homeAlternates = List.of(
                new SitemapAlternate("es", baseUrl + "/"),
                new SitemapAlternate("en", baseUrl + "/en/")
        );
        appendUrl(sb, baseUrl + "/",    null, "weekly", "1.0", null, homeAlternates);
        appendUrl(sb, baseUrl + "/en/", null, "weekly", "1.0", null, homeAlternates);

        // Paginas estaticas publicas (footer): 5 paths x 2 locales = 10 <url>.
        for (String path : STATIC_PUBLIC_PATHS) {
            String esUrl = baseUrl + path;
            String enUrl = baseUrl + "/en" + path;
            List<SitemapAlternate> alts = List.of(
                    new SitemapAlternate("es", esUrl),
                    new SitemapAlternate("en", enUrl)
            );
            appendUrl(sb, esUrl, null, "monthly", "0.5", null, alts);
            appendUrl(sb, enUrl, null, "monthly", "0.5", null, alts);
        }

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
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/plain; charset=UTF-8"));
        headers.setCacheControl("public, max-age=86400");

        if (!isProdApex()) {
            return ResponseEntity.ok().headers(headers).body(ROBOTS_DISALLOW_ALL);
        }

        String baseUrl = resolveBaseUrl();
        // Disallow por prefijo (no exact match): /dashboard cubre /dashboard-admin,
        // /dashboard-user-{client,model}; /model cubre /model-documents y /model-kyc;
        // /perfil cubre /perfil-client y /perfil-model. Confirmado contra App.jsx
        // el 2026-06-11.
        String body = ""
                + "User-agent: *\n"
                + "Allow: /blog\n"
                + "Allow: /blog/\n"
                + "\n"
                + "Disallow: /api/\n"
                + "Disallow: /admin\n"
                + "Disallow: /client\n"
                + "Disallow: /model\n"
                + "Disallow: /dashboard\n"
                + "Disallow: /login\n"
                + "Disallow: /register\n"
                + "Disallow: /unauthorized\n"
                + "Disallow: /forgot-password\n"
                + "Disallow: /reset-password\n"
                + "Disallow: /verify-email\n"
                + "Disallow: /change-password\n"
                + "Disallow: /perfil\n"
                + "\n"
                + "Sitemap: " + baseUrl + "/sitemap.xml\n";

        return ResponseEntity.ok().headers(headers).body(body);
    }

    /**
     * Discriminante de indexabilidad (ADR-033). Devuelve true solo cuando
     * `app.public.base-url` apunta exactamente al apex PROD canonico
     * (ADR-015): esquema https, host `sharemechat.com` exacto, sin puerto
     * custom. Cualquier discrepancia -> false (fail-closed).
     *
     * No discrimina por header de host de la peticion: el contrato es
     * "lo que esta configurado en este profile". Cambiar `app.public.base-url`
     * sigue siendo la unica forma de hacer indexable un entorno.
     */
    private boolean isProdApex() {
        String configured = siteProperties == null ? null : siteProperties.getBaseUrl();
        if (configured == null || configured.isBlank()) {
            return false;
        }
        try {
            URI uri = URI.create(configured);
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
        // Paquete 10.A.5: sin fallback hardcoded. La property
        // app.public.base-url DEBE estar configurada en el entorno.
        throw new IllegalStateException(
                "app.public.base-url is not configured. Set APP_PUBLIC_BASE_URL or"
                        + " override the property in application-<env>.properties.");
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
