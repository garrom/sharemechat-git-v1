package com.sharemechat.content.controller;

import com.sharemechat.content.config.ContentProperties;
import com.sharemechat.content.dto.ArticleCreateRequest;
import com.sharemechat.content.dto.ArticleDetailDTO;
import com.sharemechat.content.dto.ArticleSummaryDTO;
import com.sharemechat.content.dto.ArticleUpdateRequest;
import com.sharemechat.content.dto.ReviewEventDTO;
import com.sharemechat.content.dto.TransitionRequest;
import com.sharemechat.content.dto.VersionDTO;
import com.sharemechat.content.entity.ContentArticle;
import com.sharemechat.content.publishing.ArticlePublicDetailDTO;
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
 * Endpoints admin del CMS - Fase 1 + Fase 2 (ADR-010).
 * Acceso cubierto por la regla generica /api/admin/** de SecurityConfig
 * (ROLE_ADMIN o BO_ROLE_ADMIN). La deteccion de ADMIN se hace inspeccionando
 * authorities del Authentication para permitir bypass de segregacion y guardia
 * de edicion en estados no editables.
 */
@RestController
@RequestMapping("/api/admin/content")
public class ContentAdminController {

    private final ContentArticleService articleService;
    private final ContentBodyStorageService bodyStorageService;
    private final ContentProperties contentProperties;
    private final UserService userService;
    private final MarkdownRendererService markdownRenderer;

    public ContentAdminController(ContentArticleService articleService,
                                  ContentBodyStorageService bodyStorageService,
                                  ContentProperties contentProperties,
                                  UserService userService,
                                  MarkdownRendererService markdownRenderer) {
        this.articleService = articleService;
        this.bodyStorageService = bodyStorageService;
        this.contentProperties = contentProperties;
        this.userService = userService;
        this.markdownRenderer = markdownRenderer;
    }

    @GetMapping("/articles")
    public Map<String, Object> listArticles(
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String locale,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Page<ArticleSummaryDTO> result = articleService.listPaginated(state, locale, category, page, size);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", result.getContent());
        body.put("page", result.getNumber());
        body.put("size", result.getSize());
        body.put("totalElements", result.getTotalElements());
        body.put("totalPages", result.getTotalPages());
        return body;
    }

    @GetMapping("/articles/{id}")
    public ArticleDetailDTO getArticle(@PathVariable("id") Long articleId) {
        return articleService.findById(articleId);
    }

    @PostMapping("/articles")
    public ResponseEntity<ArticleDetailDTO> createArticle(
            @RequestBody ArticleCreateRequest request,
            Authentication authentication
    ) {
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
        Long actorUserId = resolveUserId(authentication);
        boolean isAdmin = isAdmin(authentication);
        return articleService.updateArticleMetadata(articleId, request, actorUserId, isAdmin);
    }

    @DeleteMapping("/articles/{id}")
    public ResponseEntity<Void> deleteArticle(
            @PathVariable("id") Long articleId,
            Authentication authentication
    ) {
        Long actorUserId = resolveUserId(authentication);
        articleService.deleteArticleIfDraft(articleId, actorUserId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping(value = "/articles/{id}/body", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> getArticleBody(@PathVariable("id") Long articleId) {
        ArticleDetailDTO detail = articleService.findById(articleId);
        if (detail.bodyS3Key() == null || detail.bodyS3Key().isBlank()) {
            return ResponseEntity.ok("");
        }
        try {
            String body = bodyStorageService.loadBodyAsString(detail.bodyS3Key());
            return ResponseEntity.ok(body);
        } catch (NoSuchFileException ex) {
            return ResponseEntity.ok("");
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "No se pudo leer el cuerpo del articulo", ex);
        }
    }

    /**
     * Preview privada del articulo desde admin (Fase 4A hardening).
     * - Acceso restringido por la regla generica /api/admin/** de SecurityConfig.
     * - NO publica, NO cambia estado, NO emite eventos, NO persiste nada.
     * - Reusa MarkdownRendererService (mismo render+sanitizacion que el blog publico)
     *   leyendo body_s3_key tal cual, independientemente del state actual.
     * - Devuelve la misma forma que el endpoint publico para que el frontend
     *   admin pueda reusar exactamente los estilos del detalle del blog.
     */
    @GetMapping("/articles/{id}/preview")
    public ArticlePublicDetailDTO previewArticle(@PathVariable("id") Long articleId) {
        ArticleDetailDTO detail = articleService.findById(articleId);
        String htmlBody = "";
        if (detail.bodyS3Key() != null && !detail.bodyS3Key().isBlank()) {
            try {
                String md = bodyStorageService.loadBodyAsString(detail.bodyS3Key());
                htmlBody = markdownRenderer.renderMarkdownToSafeHtml(md);
            } catch (NoSuchFileException ex) {
                // body S3 ausente; preview con cuerpo vacio
            } catch (IOException ex) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "No se pudo leer el cuerpo para preview", ex);
            }
        }
        // Fase 4A multilingue (ADR-022): el record publico exige alternates.
        // El preview admin no necesita resolver hreflang, asi que pasamos
        // lista vacia. El frontend admin reusa los estilos del blog publico
        // y simplemente no pinta los alternates en el preview.
        return new ArticlePublicDetailDTO(
                detail.id(),
                detail.slug(),
                detail.locale(),
                detail.title(),
                detail.brief(),
                detail.category(),
                detail.keywords(),
                detail.publishedAt(),
                detail.updatedAt(),
                htmlBody,
                detail.aiAssisted(),
                detail.disclosureRequired(),
                detail.heroImageUrl(),
                java.util.Collections.emptyList()
        );
    }

    @PutMapping(value = "/articles/{id}/body", consumes = MediaType.TEXT_PLAIN_VALUE)
    public Map<String, Object> putArticleBody(
            @PathVariable("id") Long articleId,
            @RequestBody(required = false) String markdown,
            Authentication authentication
    ) {
        Long actorUserId = resolveUserId(authentication);
        boolean isAdmin = isAdmin(authentication);

        // Guardia de estado editable ANTES de tocar S3 (evita objeto huerfano).
        articleService.requireEditable(articleId, isAdmin);

        String safe = markdown == null ? "" : markdown;
        byte[] bytes = safe.getBytes(StandardCharsets.UTF_8);
        long maxBytes = contentProperties.getBodyMaxBytes();
        if (bytes.length > maxBytes) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "Cuerpo excede " + maxBytes + " bytes");
        }

        ContentBodyStorageService.Result uploaded;
        try {
            uploaded = bodyStorageService.uploadDraftBody(articleId, bytes);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "No se pudo subir cuerpo a S3", ex);
        }
        ContentArticle saved = articleService.persistBodyReference(articleId,
                uploaded.s3Key(), uploaded.contentHash(), uploaded.byteSize(),
                actorUserId, isAdmin);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("articleId", saved.getId());
        response.put("bodyS3Key", saved.getBodyS3Key());
        response.put("bodyContentHash", saved.getBodyContentHash());
        response.put("byteSize", uploaded.byteSize());
        return response;
    }

    // ================================================================
    // Fase 2 — workflow editorial, versiones y eventos
    // ================================================================

    @PostMapping("/articles/{id}/transition")
    public ArticleDetailDTO transitionArticle(
            @PathVariable("id") Long articleId,
            @RequestBody TransitionRequest request,
            Authentication authentication
    ) {
        Long actorUserId = resolveUserId(authentication);
        boolean isAdmin = isAdmin(authentication);

        // ADR-016: tanto la publicacion (IN_REVIEW -> PUBLISHED) como la
        // retractacion (PUBLISHED -> RETRACTED) requieren CONTENT.PUBLISH (o
        // ADMIN implicitamente, ya que ROLE_ADMIN/BO_ROLE_ADMIN tienen todos
        // los CONTENT.* asignados via role_permissions).
        if (request != null && request.getToState() != null) {
            String toStateNorm = request.getToState().trim().toUpperCase();
            if ("PUBLISHED".equals(toStateNorm) || "RETRACTED".equals(toStateNorm)) {
                requirePermission(authentication,
                        com.sharemechat.security.BackofficeAuthorities.PERM_CONTENT_PUBLISH);
            }
        }

        return articleService.transitionState(articleId, request, actorUserId, isAdmin);
    }

    @GetMapping("/articles/{id}/versions")
    public List<VersionDTO> listVersions(@PathVariable("id") Long articleId) {
        return articleService.listVersions(articleId);
    }

    @GetMapping(value = "/articles/{id}/versions/{versionNumber}/body",
                produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> getVersionBody(
            @PathVariable("id") Long articleId,
            @PathVariable("versionNumber") Integer versionNumber
    ) {
        String body = articleService.loadVersionBody(articleId, versionNumber);
        return ResponseEntity.ok(body);
    }

    @GetMapping("/articles/{id}/events")
    public Map<String, Object> listEvents(
            @PathVariable("id") Long articleId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        Page<ReviewEventDTO> result = articleService.listEvents(articleId, page, size);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", result.getContent());
        body.put("page", result.getNumber());
        body.put("size", result.getSize());
        body.put("totalElements", result.getTotalElements());
        body.put("totalPages", result.getTotalPages());
        return body;
    }

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
