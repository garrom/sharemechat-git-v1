package com.sharemechat.content.controller;

import com.sharemechat.content.dto.ArticleCreateRequest;
import com.sharemechat.content.dto.ArticleDetailDTO;
import com.sharemechat.content.dto.ArticleUpdateRequest;
import com.sharemechat.content.dto.TransitionRequest;
import com.sharemechat.content.dto.VersionDTO;
import com.sharemechat.content.publishing.ArticlePublicDetailDTO;
import com.sharemechat.content.service.ContentArticleService;
import com.sharemechat.entity.User;
import com.sharemechat.security.BackofficeAuthorities;
import com.sharemechat.service.UserService;
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

import java.util.List;
import java.util.Map;

/**
 * Endpoints admin del CMS.
 *
 * --------------------------------------------------------------------
 * PAQUETE 2 (ADR-025): ESTADO MIXTO.
 *
 * Reactivado: POST /articles (createArticle).
 *
 * Sigue neutralizado con UnsupportedOperationException (Pendiente paquete 3):
 *  - GET /articles, GET /articles/{id}
 *  - PATCH /articles/{id}, DELETE /articles/{id}
 *  - GET/PUT /articles/{id}/body, GET /articles/{id}/preview
 *  - POST /articles/{id}/transition
 *  - GET /articles/{id}/versions, GET /articles/{id}/versions/{n}/body
 *  - GET /articles/{id}/events
 *
 * La logica de service para estos otros endpoints SI esta implementada
 * en ContentArticleService; solo falta reactivar el binding HTTP.
 * --------------------------------------------------------------------
 */
@RestController
@RequestMapping("/api/admin/content")
public class ContentAdminController {

    private static final String MSG_P3 =
            "Pendiente paquete 3 — rediseño CMS bilingüe (ADR-025)";

    private final ContentArticleService articleService;
    private final UserService userService;

    public ContentAdminController(ContentArticleService articleService,
                                  UserService userService) {
        this.articleService = articleService;
        this.userService = userService;
    }

    // ================================================================
    // Reactivado en paquete 2
    // ================================================================

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

    // ================================================================
    // Neutralizado hasta paquete 3
    // ================================================================

    @GetMapping("/articles")
    public Map<String, Object> listArticles(
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String locale,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        throw new UnsupportedOperationException(MSG_P3);
    }

    @GetMapping("/articles/{id}")
    public ArticleDetailDTO getArticle(@PathVariable("id") Long articleId) {
        throw new UnsupportedOperationException(MSG_P3);
    }

    @PatchMapping("/articles/{id}")
    public ArticleDetailDTO updateArticle(
            @PathVariable("id") Long articleId,
            @RequestBody ArticleUpdateRequest request,
            Authentication authentication
    ) {
        throw new UnsupportedOperationException(MSG_P3);
    }

    @DeleteMapping("/articles/{id}")
    public ResponseEntity<Void> deleteArticle(
            @PathVariable("id") Long articleId,
            Authentication authentication
    ) {
        throw new UnsupportedOperationException(MSG_P3);
    }

    @GetMapping(value = "/articles/{id}/body", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> getArticleBody(@PathVariable("id") Long articleId) {
        throw new UnsupportedOperationException(MSG_P3);
    }

    @GetMapping("/articles/{id}/preview")
    public ArticlePublicDetailDTO previewArticle(@PathVariable("id") Long articleId) {
        throw new UnsupportedOperationException(MSG_P3);
    }

    @PutMapping(value = "/articles/{id}/body", consumes = MediaType.TEXT_PLAIN_VALUE)
    public Map<String, Object> putArticleBody(
            @PathVariable("id") Long articleId,
            @RequestBody(required = false) String markdown,
            Authentication authentication
    ) {
        throw new UnsupportedOperationException(MSG_P3);
    }

    @PostMapping("/articles/{id}/transition")
    public ArticleDetailDTO transitionArticle(
            @PathVariable("id") Long articleId,
            @RequestBody TransitionRequest request,
            Authentication authentication
    ) {
        throw new UnsupportedOperationException(MSG_P3);
    }

    @GetMapping("/articles/{id}/versions")
    public List<VersionDTO> listVersions(@PathVariable("id") Long articleId) {
        throw new UnsupportedOperationException(MSG_P3);
    }

    @GetMapping(value = "/articles/{id}/versions/{versionNumber}/body",
                produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> getVersionBody(
            @PathVariable("id") Long articleId,
            @PathVariable("versionNumber") Integer versionNumber
    ) {
        throw new UnsupportedOperationException(MSG_P3);
    }

    @GetMapping("/articles/{id}/events")
    public Map<String, Object> listEvents(
            @PathVariable("id") Long articleId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        throw new UnsupportedOperationException(MSG_P3);
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
