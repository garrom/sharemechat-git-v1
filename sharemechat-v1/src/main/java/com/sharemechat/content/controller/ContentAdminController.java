package com.sharemechat.content.controller;

import com.sharemechat.content.config.ContentProperties;
import com.sharemechat.content.dto.ArticleCreateRequest;
import com.sharemechat.content.dto.ArticleDetailDTO;
import com.sharemechat.content.dto.ArticleSummaryDTO;
import com.sharemechat.content.dto.ArticleUpdateRequest;
import com.sharemechat.content.entity.ContentArticle;
import com.sharemechat.content.service.ContentArticleService;
import com.sharemechat.content.service.ContentBodyStorageService;
import com.sharemechat.entity.User;
import com.sharemechat.service.UserService;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
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
import java.util.Map;

/**
 * Endpoints admin del CMS - Fase 1 (ADR-010).
 * Acceso cubierto por la regla generica /api/admin/** de SecurityConfig
 * (ROLE_ADMIN o BO_ROLE_ADMIN).
 */
@RestController
@RequestMapping("/api/admin/content")
public class ContentAdminController {

    private final ContentArticleService articleService;
    private final ContentBodyStorageService bodyStorageService;
    private final ContentProperties contentProperties;
    private final UserService userService;

    public ContentAdminController(ContentArticleService articleService,
                                  ContentBodyStorageService bodyStorageService,
                                  ContentProperties contentProperties,
                                  UserService userService) {
        this.articleService = articleService;
        this.bodyStorageService = bodyStorageService;
        this.contentProperties = contentProperties;
        this.userService = userService;
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
        return articleService.updateArticleMetadata(articleId, request, actorUserId);
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

    @PutMapping(value = "/articles/{id}/body", consumes = MediaType.TEXT_PLAIN_VALUE)
    public Map<String, Object> putArticleBody(
            @PathVariable("id") Long articleId,
            @RequestBody(required = false) String markdown,
            Authentication authentication
    ) {
        articleService.requireExisting(articleId);
        String safe = markdown == null ? "" : markdown;
        byte[] bytes = safe.getBytes(StandardCharsets.UTF_8);
        long maxBytes = contentProperties.getBodyMaxBytes();
        if (bytes.length > maxBytes) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "Cuerpo excede " + maxBytes + " bytes");
        }
        Long actorUserId = resolveUserId(authentication);

        ContentBodyStorageService.Result uploaded;
        try {
            uploaded = bodyStorageService.uploadDraftBody(articleId, bytes);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "No se pudo subir cuerpo a S3", ex);
        }
        ContentArticle saved = articleService.persistBodyReference(articleId,
                uploaded.s3Key(), uploaded.contentHash(), actorUserId);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("articleId", saved.getId());
        response.put("bodyS3Key", saved.getBodyS3Key());
        response.put("bodyContentHash", saved.getBodyContentHash());
        response.put("byteSize", uploaded.byteSize());
        return response;
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
}
