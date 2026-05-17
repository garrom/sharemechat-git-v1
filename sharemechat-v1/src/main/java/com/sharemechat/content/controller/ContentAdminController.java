package com.sharemechat.content.controller;

import com.sharemechat.content.dto.ArticleCreateRequest;
import com.sharemechat.content.dto.ArticleDetailDTO;
import com.sharemechat.content.dto.ArticleSummaryDTO;
import com.sharemechat.content.dto.ArticleUpdateRequest;
import com.sharemechat.content.dto.ReviewEventDTO;
import com.sharemechat.content.dto.TranslationDetailDTO;
import com.sharemechat.content.dto.TranslationPreviewDTO;
import com.sharemechat.content.dto.TransitionRequest;
import com.sharemechat.content.dto.VersionDTO;
import com.sharemechat.content.publishing.MarkdownRendererService;
import com.sharemechat.content.service.ContentArticleService;
import com.sharemechat.content.service.ContentBodyStorageService;
import com.sharemechat.entity.User;
import com.sharemechat.security.BackofficeAuthorities;
import com.sharemechat.service.UserService;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.NoSuchFileException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Endpoints admin del CMS bilingue (ADR-025, paquete 3).
 *
 * Reactivados en paquete 3:
 *  - GET  /articles                                listado paginado
 *  - GET  /articles/{id}                           detalle con traducciones
 *  - POST /articles                                crear articulo + traduccion ES
 *  - PATCH /articles/{id}                          editar metadata compartida
 *  - DELETE /articles/{id}                         borrar (solo DRAFT)
 *  - POST /articles/{id}/transition                workflow estado
 *  - GET  /articles/{id}/versions                  listado versiones con snapshots por locale
 *  - GET  /articles/{id}/events                    auditoria editorial
 *  - GET  /articles/{id}/translations/{locale}/body      lee body markdown per-locale
 *  - PUT  /articles/{id}/translations/{locale}/body      sobreescribe body markdown per-locale
 *  - GET  /articles/{id}/translations/{locale}/preview   render HTML preview per-locale
 *  - GET  /articles/{id}/versions/{n}/translations/{locale}/body
 *                                                  body congelado de version per-locale
 *
 * Eliminados respecto al paquete 0 (rutas monolingues sustituidas por
 * variantes per-locale):
 *  - GET/PUT /articles/{id}/body
 *  - GET     /articles/{id}/preview
 *  - GET     /articles/{id}/versions/{n}/body
 */
@RestController
@RequestMapping("/api/admin/content")
public class ContentAdminController {

    private final ContentArticleService articleService;
    private final ContentBodyStorageService bodyStorageService;
    private final MarkdownRendererService markdownRenderer;
    private final UserService userService;

    public ContentAdminController(ContentArticleService articleService,
                                  ContentBodyStorageService bodyStorageService,
                                  MarkdownRendererService markdownRenderer,
                                  UserService userService) {
        this.articleService = articleService;
        this.bodyStorageService = bodyStorageService;
        this.markdownRenderer = markdownRenderer;
        this.userService = userService;
    }

    // ================================================================
    // CRUD articulo
    // ================================================================

    @GetMapping("/articles")
    public Map<String, Object> listArticles(
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication
    ) {
        requirePermission(authentication, BackofficeAuthorities.PERM_CONTENT_VIEW);
        Page<ArticleSummaryDTO> result = articleService.listPaginated(state, category, page, size);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", result.getContent());
        body.put("page", result.getNumber());
        body.put("size", result.getSize());
        body.put("totalElements", result.getTotalElements());
        body.put("totalPages", result.getTotalPages());
        return body;
    }

    @GetMapping("/articles/{id}")
    public ArticleDetailDTO getArticle(
            @PathVariable("id") Long articleId,
            Authentication authentication
    ) {
        requirePermission(authentication, BackofficeAuthorities.PERM_CONTENT_VIEW);
        return articleService.findById(articleId);
    }

    @PostMapping("/articles")
    public ResponseEntity<ArticleDetailDTO> createArticle(
            @RequestBody ArticleCreateRequest request,
            Authentication authentication
    ) {
        requirePermission(authentication, BackofficeAuthorities.PERM_CONTENT_EDIT);
        Long actorUserId = resolveUserId(authentication);
        ArticleDetailDTO created = articleService.createArticle(request, actorUserId);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PatchMapping("/articles/{id}")
    public ArticleDetailDTO updateArticle(
            @PathVariable("id") Long articleId,
            @RequestBody ArticleUpdateRequest request,
            Authentication authentication
    ) {
        requirePermission(authentication, BackofficeAuthorities.PERM_CONTENT_EDIT);
        Long actorUserId = resolveUserId(authentication);
        boolean isAdmin = isAdmin(authentication);
        return articleService.updateArticleMetadata(articleId, request, actorUserId, isAdmin);
    }

    @DeleteMapping("/articles/{id}")
    public ResponseEntity<Void> deleteArticle(
            @PathVariable("id") Long articleId,
            Authentication authentication
    ) {
        requirePermission(authentication, BackofficeAuthorities.PERM_CONTENT_EDIT);
        Long actorUserId = resolveUserId(authentication);
        articleService.deleteArticleIfDraft(articleId, actorUserId);
        return ResponseEntity.noContent().build();
    }

    // ================================================================
    // Body y preview per-locale
    // ================================================================

    @GetMapping(value = "/articles/{id}/translations/{locale}/body",
                produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> getTranslationBody(
            @PathVariable("id") Long articleId,
            @PathVariable("locale") String localeRaw,
            Authentication authentication
    ) {
        requirePermission(authentication, BackofficeAuthorities.PERM_CONTENT_VIEW);
        String locale = articleService.normalizeLocalePublic(localeRaw);
        TranslationDetailDTO tr = resolveTranslationOr404(articleId, locale);
        if (tr.bodyS3Key() == null || tr.bodyS3Key().isBlank()) {
            return ResponseEntity.ok("");
        }
        try {
            String body = bodyStorageService.loadBodyAsString(tr.bodyS3Key());
            return ResponseEntity.ok(body);
        } catch (NoSuchFileException ex) {
            // Translation referencia una key que ya no esta en S3: tratamos como
            // body vacio (estado inconsistente bounded; el operador puede re-PUT).
            return ResponseEntity.ok("");
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "No se pudo leer el cuerpo de la traduccion", ex);
        }
    }

    @PutMapping(value = "/articles/{id}/translations/{locale}/body",
                consumes = MediaType.TEXT_PLAIN_VALUE)
    public Map<String, Object> putTranslationBody(
            @PathVariable("id") Long articleId,
            @PathVariable("locale") String localeRaw,
            @RequestBody(required = false) String markdown,
            Authentication authentication
    ) {
        requirePermission(authentication, BackofficeAuthorities.PERM_CONTENT_EDIT);
        Long actorUserId = resolveUserId(authentication);
        boolean isAdmin = isAdmin(authentication);
        String safe = markdown == null ? "" : markdown;
        byte[] bytes = safe.getBytes(StandardCharsets.UTF_8);

        ArticleDetailDTO updated = articleService.updateTranslationBody(
                articleId, localeRaw, bytes, actorUserId, isAdmin);
        TranslationDetailDTO tr = resolveTranslationFromDetail(updated, localeRaw);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("articleId", updated.id());
        response.put("locale", tr.locale());
        response.put("bodyS3Key", tr.bodyS3Key());
        response.put("bodyContentHash", tr.bodyContentHash());
        response.put("byteSize", bytes.length);
        return response;
    }

    @GetMapping("/articles/{id}/translations/{locale}/preview")
    public TranslationPreviewDTO previewTranslation(
            @PathVariable("id") Long articleId,
            @PathVariable("locale") String localeRaw,
            Authentication authentication
    ) {
        requirePermission(authentication, BackofficeAuthorities.PERM_CONTENT_VIEW);
        String locale = articleService.normalizeLocalePublic(localeRaw);
        ArticleDetailDTO detail = articleService.findById(articleId);
        TranslationDetailDTO tr = pickTranslationOr404(detail, locale);

        String htmlBody = "";
        if (tr.bodyS3Key() != null && !tr.bodyS3Key().isBlank()) {
            try {
                String md = bodyStorageService.loadBodyAsString(tr.bodyS3Key());
                htmlBody = markdownRenderer.renderMarkdownToSafeHtml(md);
            } catch (NoSuchFileException ex) {
                // Inconsistencia BD<->S3 bounded: preview con cuerpo vacio.
            } catch (IOException ex) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "No se pudo leer el cuerpo de la traduccion para preview", ex);
            }
        }

        return new TranslationPreviewDTO(
                detail.id(),
                tr.locale(),
                tr.slug(),
                tr.title(),
                detail.brief(),
                detail.category(),
                detail.heroImageUrl(),
                htmlBody
        );
    }

    // ================================================================
    // Workflow editorial
    // ================================================================

    @PostMapping("/articles/{id}/transition")
    public ArticleDetailDTO transitionArticle(
            @PathVariable("id") Long articleId,
            @RequestBody TransitionRequest request,
            Authentication authentication
    ) {
        // CONTENT.EDIT siempre; CONTENT.PUBLISH adicional si destino es
        // PUBLISHED o RETRACTED (ADR-016).
        requirePermission(authentication, BackofficeAuthorities.PERM_CONTENT_EDIT);
        if (request != null && request.getToState() != null) {
            String toStateNorm = request.getToState().trim().toUpperCase();
            if ("PUBLISHED".equals(toStateNorm) || "RETRACTED".equals(toStateNorm)) {
                requirePermission(authentication, BackofficeAuthorities.PERM_CONTENT_PUBLISH);
            }
        }
        Long actorUserId = resolveUserId(authentication);
        boolean isAdmin = isAdmin(authentication);
        return articleService.transitionState(articleId, request, actorUserId, isAdmin);
    }

    // ================================================================
    // Versiones y eventos
    // ================================================================

    @GetMapping("/articles/{id}/versions")
    public List<VersionDTO> listVersions(
            @PathVariable("id") Long articleId,
            Authentication authentication
    ) {
        requirePermission(authentication, BackofficeAuthorities.PERM_CONTENT_VIEW);
        return articleService.listVersions(articleId);
    }

    @GetMapping(value = "/articles/{id}/versions/{versionNumber}/translations/{locale}/body",
                produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> getVersionTranslationBody(
            @PathVariable("id") Long articleId,
            @PathVariable("versionNumber") Integer versionNumber,
            @PathVariable("locale") String localeRaw,
            Authentication authentication
    ) {
        requirePermission(authentication, BackofficeAuthorities.PERM_CONTENT_VIEW);
        String body = articleService.loadVersionBody(articleId, versionNumber, localeRaw);
        return ResponseEntity.ok(body);
    }

    @GetMapping("/articles/{id}/events")
    public Map<String, Object> listEvents(
            @PathVariable("id") Long articleId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            Authentication authentication
    ) {
        requirePermission(authentication, BackofficeAuthorities.PERM_CONTENT_VIEW);
        Page<ReviewEventDTO> result = articleService.listEvents(articleId, page, size);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", result.getContent());
        body.put("page", result.getNumber());
        body.put("size", result.getSize());
        body.put("totalElements", result.getTotalElements());
        body.put("totalPages", result.getTotalPages());
        return body;
    }

    // ================================================================
    // Helpers internos
    // ================================================================

    /**
     * Devuelve la traduccion del locale dado, o 404 si no existe en BD.
     * Para uso en endpoints que necesitan resolver el bodyS3Key sin
     * llamar al service.
     */
    private TranslationDetailDTO resolveTranslationOr404(Long articleId, String locale) {
        ArticleDetailDTO detail = articleService.findById(articleId);
        return pickTranslationOr404(detail, locale);
    }

    private TranslationDetailDTO pickTranslationOr404(ArticleDetailDTO detail, String locale) {
        return detail.translations().stream()
                .filter(t -> locale.equals(t.locale()))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Traduccion " + locale + " no encontrada para articleId=" + detail.id()));
    }

    /**
     * Tras un PUT body que pudo crear la translation, la encuentra en el
     * detail ya actualizado por updateTranslationBody.
     */
    private TranslationDetailDTO resolveTranslationFromDetail(ArticleDetailDTO detail, String localeRaw) {
        String locale = articleService.normalizeLocalePublic(localeRaw);
        return pickTranslationOr404(detail, locale);
    }

    // ================================================================
    // Helpers de seguridad
    // ================================================================

    private Long resolveUserId(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "No autenticado");
        }
        User user = userService.findByEmail(authentication.getName());
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario no resuelto");
        }
        return user.getId();
    }

    private boolean isAdmin(Authentication authentication) {
        if (authentication == null || authentication.getAuthorities() == null) return false;
        String boRoleAdmin = BackofficeAuthorities.roleAuthority(BackofficeAuthorities.ROLE_ADMIN);
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(a -> "ROLE_ADMIN".equals(a) || boRoleAdmin.equals(a));
    }

    private void requirePermission(Authentication authentication, String permissionCode) {
        if (authentication == null || authentication.getAuthorities() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Permiso requerido: " + permissionCode);
        }
        String roleAdmin = "ROLE_ADMIN";
        String boRoleAdmin = BackofficeAuthorities.roleAuthority(BackofficeAuthorities.ROLE_ADMIN);
        String permAuthority = BackofficeAuthorities.permissionAuthority(permissionCode);
        boolean ok = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(a -> roleAdmin.equals(a) || boRoleAdmin.equals(a) || permAuthority.equals(a));
        if (!ok) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Permiso requerido: " + permissionCode);
        }
    }
}
