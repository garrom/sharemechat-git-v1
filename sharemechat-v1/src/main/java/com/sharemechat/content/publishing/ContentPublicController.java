package com.sharemechat.content.publishing;

import com.sharemechat.config.PublicSiteProperties;
import com.sharemechat.content.constants.ContentConstants;
import com.sharemechat.content.entity.ContentArticle;
import com.sharemechat.content.repository.ContentArticleRepository;
import com.sharemechat.content.service.ContentBodyStorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.NoSuchFileException;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Endpoints publicos del CMS para el blog (Fase 4A, ADR-010).
 * - Sin autenticacion (cubierto por permitAll en SecurityConfig).
 * - Solo expone articulos en estado PUBLISHED.
 * - Render Markdown -> HTML sanitizado en backend, devuelto al frontend.
 *
 * Fase 4A NO genera HTML estatico, NO toca CloudFront, NO emite sitemap.
 * Una sola via de servicio: API JSON consumida por el SPA publico.
 *
 * Fase 4A multilingue (ADR-022):
 *  - listArticles acepta locale con default "es" (filtrado por locale).
 *  - getArticleBySlug acepta locale con default "es" y resuelve por
 *    (slug, locale). 200 si PUBLISHED, 410 si RETRACTED, 404 en otro caso.
 *  - El detalle PUBLISHED incluye alternates (otras versiones del mismo
 *    grupo via parent_article_id) para hreflang y switcher manual.
 */
@RestController
@RequestMapping("/api/public/content")
public class ContentPublicController {

    private static final Logger log = LoggerFactory.getLogger(ContentPublicController.class);

    /** Tope defensivo de tamano de pagina publica. */
    private static final int PUBLIC_PAGE_SIZE_DEFAULT = 20;
    private static final int PUBLIC_PAGE_SIZE_MAX = 50;

    /** Locale por defecto cuando el cliente no envia parametro. ADR-022. */
    private static final String DEFAULT_LOCALE = "es";

    private final ContentArticleRepository articleRepo;
    private final ContentBodyStorageService bodyStorageService;
    private final MarkdownRendererService markdownRenderer;
    private final PublicSiteProperties siteProperties;

    public ContentPublicController(ContentArticleRepository articleRepo,
                                   ContentBodyStorageService bodyStorageService,
                                   MarkdownRendererService markdownRenderer,
                                   PublicSiteProperties siteProperties) {
        this.articleRepo = articleRepo;
        this.bodyStorageService = bodyStorageService;
        this.markdownRenderer = markdownRenderer;
        this.siteProperties = siteProperties;
    }

    @GetMapping("/articles")
    public Map<String, Object> listArticles(
            @RequestParam(defaultValue = DEFAULT_LOCALE) String locale,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        int safePage = Math.max(0, page);
        int safeSize = size <= 0 ? PUBLIC_PAGE_SIZE_DEFAULT : Math.min(size, PUBLIC_PAGE_SIZE_MAX);
        Pageable pageable = PageRequest.of(safePage, safeSize);

        // Normalizacion defensiva: el default ya es "es", pero si el cliente
        // envia explicitamente "ES" o " es " lo aceptamos igualmente.
        String normalizedLocale = blankToNull(locale);
        if (normalizedLocale != null) {
            normalizedLocale = normalizedLocale.toLowerCase(Locale.ROOT);
        } else {
            normalizedLocale = DEFAULT_LOCALE;
        }
        String normalizedCategory = blankToNull(category);

        Page<ContentArticle> result = articleRepo.findPublished(
                normalizedLocale, normalizedCategory, pageable);

        List<ArticlePublicSummaryDTO> items = result.getContent().stream()
                .map(this::toSummary)
                .toList();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", items);
        body.put("page", result.getNumber());
        body.put("size", result.getSize());
        body.put("totalElements", result.getTotalElements());
        body.put("totalPages", result.getTotalPages());
        return body;
    }

    /**
     * ADR-016 + ADR-022: respuestas posibles segun (slug, locale) y estado.
     *  - PUBLISHED -> 200 con cuerpo HTML sanitizado + alternates del grupo.
     *  - RETRACTED -> 410 Gone con body tombstone y header X-Robots-Tag: noindex.
     *  - DRAFT, IN_REVIEW, SCHEDULED, locale inexistente o slug inexistente -> 404
     *    (sin filtrar al publico el estado real).
     *
     * Cambio vs implementacion previa: el resolver es ahora estricto por
     * (slug, locale), no por slug en cualquier locale. Si un slug solo existe
     * en otro locale, devuelve 404 (el frontend / switcher debe usar el
     * alternates del detalle del locale correcto).
     */
    @GetMapping("/articles/{slug}")
    public ResponseEntity<?> getArticleBySlug(
            @PathVariable("slug") String slugRaw,
            @RequestParam(defaultValue = DEFAULT_LOCALE) String localeRaw
    ) {
        String slug = slugRaw == null ? null : slugRaw.trim().toLowerCase(Locale.ROOT);
        if (slug == null || slug.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "slug requerido");
        }

        String locale = localeRaw == null ? DEFAULT_LOCALE : localeRaw.trim().toLowerCase(Locale.ROOT);
        if (locale.isEmpty()) {
            locale = DEFAULT_LOCALE;
        }

        ContentArticle article = articleRepo.findBySlugAndLocale(slug, locale).orElse(null);
        if (article == null) {
            // No existe en este (slug, locale). Cualquier otra combinacion
            // (otro locale, otro slug) queda fuera del alcance de esta
            // respuesta: el frontend debe consultar el endpoint correcto.
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Articulo no publicado o inexistente");
        }

        if (ContentConstants.STATE_PUBLISHED.equals(article.getState())) {
            String htmlBody = "";
            String bodyKey = article.getBodyS3Key();
            if (bodyKey != null && !bodyKey.isBlank()) {
                try {
                    String markdown = bodyStorageService.loadBodyAsString(bodyKey);
                    htmlBody = markdownRenderer.renderMarkdownToSafeHtml(markdown);
                } catch (NoSuchFileException ex) {
                    log.warn("[CONTENT][PUBLIC] body S3 ausente para slug={} locale={} key={}",
                            slug, locale, bodyKey);
                } catch (IOException ex) {
                    throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                            "No se pudo leer el cuerpo del articulo", ex);
                }
            }

            List<ArticleAlternateDTO> alternates = loadAlternates(article);

            ArticlePublicDetailDTO body = new ArticlePublicDetailDTO(
                    article.getId(),
                    article.getSlug(),
                    article.getLocale(),
                    article.getTitle(),
                    article.getBrief(),
                    article.getCategory(),
                    article.getKeywords(),
                    article.getPublishedAt(),
                    article.getUpdatedAt(),
                    htmlBody,
                    article.isAiAssisted(),
                    article.isDisclosureRequired(),
                    article.getHeroImageUrl(),
                    alternates
            );
            return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(body);
        }

        if (ContentConstants.STATE_RETRACTED.equals(article.getState())) {
            Map<String, Object> tombstone = new LinkedHashMap<>();
            tombstone.put("error", "retracted");
            tombstone.put("slug", article.getSlug());
            tombstone.put("retracted_at",
                    article.getRetractedAt() == null ? null : article.getRetractedAt().toString());
            return ResponseEntity.status(HttpStatus.GONE)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-Robots-Tag", "noindex")
                    .body(tombstone);
        }

        // DRAFT / IN_REVIEW / SCHEDULED u otro estado no publico -> 404 sin
        // filtrar al usuario que el articulo existe en otro estado.
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Articulo no publicado o inexistente");
    }

    private ArticlePublicSummaryDTO toSummary(ContentArticle a) {
        return new ArticlePublicSummaryDTO(
                a.getId(),
                a.getSlug(),
                a.getLocale(),
                a.getTitle(),
                a.getBrief(),
                a.getCategory(),
                a.getKeywords(),
                a.getPublishedAt(),
                a.getHeroImageUrl()
        );
    }

    /**
     * Carga las versiones alternativas PUBLISHED del mismo grupo y las
     * mapea a DTO con URL absoluta. Si el articulo no tiene parent ni
     * hijos publicados, devuelve lista vacia (nunca null).
     */
    private List<ArticleAlternateDTO> loadAlternates(ContentArticle article) {
        List<ContentArticle> alts = articleRepo.findAlternates(
                article.getId(), article.getParentArticleId());
        if (alts == null || alts.isEmpty()) {
            return Collections.emptyList();
        }
        return alts.stream()
                .map(a -> new ArticleAlternateDTO(
                        a.getLocale(),
                        a.getSlug(),
                        buildAlternateUrl(a.getLocale(), a.getSlug())))
                .toList();
    }

    /**
     * Construye la URL absoluta de una version alternativa segun la
     * convencion de prefijos de ADR-022:
     *  - locale "es" (default): {baseUrl}/blog/{slug}
     *  - resto:                 {baseUrl}/{locale}/blog/{slug}
     * Reutiliza PublicSiteProperties (ADR-015) para no hardcodear hosts.
     */
    private String buildAlternateUrl(String locale, String slug) {
        String base = siteProperties.getBaseUrl();
        if (base == null) base = "";
        String safeLocale = locale == null ? DEFAULT_LOCALE : locale.toLowerCase(Locale.ROOT);
        if (DEFAULT_LOCALE.equals(safeLocale)) {
            return base + "/blog/" + slug;
        }
        return base + "/" + safeLocale + "/blog/" + slug;
    }

    private String blankToNull(String raw) {
        if (raw == null) return null;
        String t = raw.trim();
        return t.isEmpty() ? null : t;
    }
}
