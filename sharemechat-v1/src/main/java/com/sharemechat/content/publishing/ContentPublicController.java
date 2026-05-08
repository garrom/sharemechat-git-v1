package com.sharemechat.content.publishing;

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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Endpoints publicos del CMS para el blog (Fase 4A, ADR-010).
 * - Sin autenticacion (cubierto por permitAll en SecurityConfig).
 * - Solo expone articulos en estado PUBLISHED.
 * - Render Markdown -> HTML sanitizado en backend, devuelto al frontend.
 *
 * Fase 4A NO genera HTML estatico, NO toca CloudFront, NO emite sitemap.
 * Una sola via de servicio: API JSON consumida por el SPA publico.
 */
@RestController
@RequestMapping("/api/public/content")
public class ContentPublicController {

    private static final Logger log = LoggerFactory.getLogger(ContentPublicController.class);

    /** Tope defensivo de tamano de pagina publica. */
    private static final int PUBLIC_PAGE_SIZE_DEFAULT = 20;
    private static final int PUBLIC_PAGE_SIZE_MAX = 50;

    private final ContentArticleRepository articleRepo;
    private final ContentBodyStorageService bodyStorageService;
    private final MarkdownRendererService markdownRenderer;

    public ContentPublicController(ContentArticleRepository articleRepo,
                                   ContentBodyStorageService bodyStorageService,
                                   MarkdownRendererService markdownRenderer) {
        this.articleRepo = articleRepo;
        this.bodyStorageService = bodyStorageService;
        this.markdownRenderer = markdownRenderer;
    }

    @GetMapping("/articles")
    public Map<String, Object> listArticles(
            @RequestParam(required = false) String locale,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        int safePage = Math.max(0, page);
        int safeSize = size <= 0 ? PUBLIC_PAGE_SIZE_DEFAULT : Math.min(size, PUBLIC_PAGE_SIZE_MAX);
        Pageable pageable = PageRequest.of(safePage, safeSize);

        String normalizedLocale = blankToNull(locale);
        if (normalizedLocale != null) {
            normalizedLocale = normalizedLocale.toLowerCase(Locale.ROOT);
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
     * ADR-016: tres respuestas posibles segun el estado del articulo.
     *  - PUBLISHED -> 200 con cuerpo HTML sanitizado.
     *  - RETRACTED -> 410 Gone con un body JSON tombstone (slug, retracted_at)
     *    y header `X-Robots-Tag: noindex` para reforzar la desindexacion.
     *  - DRAFT, IN_REVIEW, SCHEDULED o slug inexistente -> 404 (sin filtrar
     *    al publico el estado real).
     */
    @GetMapping("/articles/{slug}")
    public ResponseEntity<?> getArticleBySlug(@PathVariable("slug") String slugRaw) {
        String slug = slugRaw == null ? null : slugRaw.trim().toLowerCase(Locale.ROOT);
        if (slug == null || slug.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "slug requerido");
        }

        // findBySlugOrderByIdAsc devuelve los articulos con ese slug en cualquier
        // estado y locale; preferimos el primero PUBLISHED si existe, luego el
        // primero RETRACTED, e ignoramos DRAFT / IN_REVIEW / SCHEDULED.
        List<ContentArticle> matches = articleRepo.findBySlugOrderByIdAsc(slug);

        Optional<ContentArticle> publishedMatch = matches.stream()
                .filter(a -> ContentConstants.STATE_PUBLISHED.equals(a.getState()))
                .findFirst();
        if (publishedMatch.isPresent()) {
            ContentArticle article = publishedMatch.get();
            String htmlBody = "";
            String bodyKey = article.getBodyS3Key();
            if (bodyKey != null && !bodyKey.isBlank()) {
                try {
                    String markdown = bodyStorageService.loadBodyAsString(bodyKey);
                    htmlBody = markdownRenderer.renderMarkdownToSafeHtml(markdown);
                } catch (NoSuchFileException ex) {
                    log.warn("[CONTENT][PUBLIC] body S3 ausente para slug={} key={}", slug, bodyKey);
                } catch (IOException ex) {
                    throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                            "No se pudo leer el cuerpo del articulo", ex);
                }
            }
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
                    article.isDisclosureRequired()
            );
            return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(body);
        }

        Optional<ContentArticle> retractedMatch = matches.stream()
                .filter(a -> ContentConstants.STATE_RETRACTED.equals(a.getState()))
                .findFirst();
        if (retractedMatch.isPresent()) {
            ContentArticle article = retractedMatch.get();
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

        // Cualquier otro estado o slug inexistente -> 404.
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
                a.getPublishedAt()
        );
    }

    private String blankToNull(String raw) {
        if (raw == null) return null;
        String t = raw.trim();
        return t.isEmpty() ? null : t;
    }
}
