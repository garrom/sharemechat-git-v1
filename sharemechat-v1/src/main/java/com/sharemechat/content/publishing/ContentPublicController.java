package com.sharemechat.content.publishing;

import com.sharemechat.content.service.ContentArticleService;
import org.springframework.data.domain.Page;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;

/**
 * Endpoints publicos del CMS para el blog (paquete 5, ADR-025).
 *
 * Sin autenticacion (cubierto por permitAll en SecurityConfig).
 *
 *  - GET /api/public/content/articles?locale=es|en&category=&page=&size=
 *      Listado paginado de articulos PUBLISHED filtrados por locale (y
 *      opcionalmente por category). Solo devuelve articulos que tengan
 *      traduccion publicada en ese locale.
 *
 *  - GET /api/public/content/articles/{slug}?locale=es|en
 *      Detalle del articulo identificado por (slug, locale). Incluye
 *      htmlBody renderizado/sanitizado + alternates (otras translations
 *      del mismo articulo logico que tambien esten publicadas).
 *
 * Errores publicos: cualquier 404 va sin detalles internos. Caches HTTP
 * cortos (5 minutos) para reducir carga sin retrasar publicaciones.
 */
@RestController
@RequestMapping("/api/public/content")
public class ContentPublicController {

    private static final Set<String> ALLOWED_LOCALES = Set.of("es", "en");
    private static final long PUBLIC_CACHE_SECONDS = 300; // 5 minutos

    private final ContentArticleService articleService;

    public ContentPublicController(ContentArticleService articleService) {
        this.articleService = articleService;
    }

    @GetMapping("/articles")
    public ResponseEntity<Map<String, Object>> listArticles(
            @RequestParam(name = "locale", required = false) String locale,
            @RequestParam(name = "category", required = false) String category,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size
    ) {
        validateLocaleOrBadRequest(locale);
        Page<ArticlePublicSummaryDTO> result =
                articleService.listPublicByLocale(locale, category, page, size);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", result.getContent());
        body.put("page", result.getNumber());
        body.put("size", result.getSize());
        body.put("totalElements", result.getTotalElements());
        body.put("totalPages", result.getTotalPages());

        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(PUBLIC_CACHE_SECONDS, TimeUnit.SECONDS).cachePublic())
                .contentType(MediaType.APPLICATION_JSON)
                .body(body);
    }

    @GetMapping("/articles/{slug}")
    public ResponseEntity<ArticlePublicDetailDTO> getArticleBySlug(
            @PathVariable("slug") String slug,
            @RequestParam(name = "locale", required = false) String locale
    ) {
        validateLocaleOrBadRequest(locale);
        ArticlePublicDetailDTO detail = articleService.findPublicBySlugAndLocale(slug, locale);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(PUBLIC_CACHE_SECONDS, TimeUnit.SECONDS).cachePublic())
                .contentType(MediaType.APPLICATION_JSON)
                .body(detail);
    }

    private void validateLocaleOrBadRequest(String locale) {
        if (locale == null || locale.isBlank() || !ALLOWED_LOCALES.contains(locale.trim().toLowerCase())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "locale requerido (valores admitidos: es, en)");
        }
    }
}
