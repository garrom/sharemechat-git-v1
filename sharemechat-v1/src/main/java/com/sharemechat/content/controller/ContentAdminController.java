package com.sharemechat.content.controller;

import com.sharemechat.content.dto.ArticleCreateRequest;
import com.sharemechat.content.dto.ArticleDetailDTO;
import com.sharemechat.content.dto.ArticleUpdateRequest;
import com.sharemechat.content.dto.ReviewEventDTO;
import com.sharemechat.content.dto.TransitionRequest;
import com.sharemechat.content.dto.VersionDTO;
import com.sharemechat.content.publishing.ArticlePublicDetailDTO;
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

import java.util.List;
import java.util.Map;

/**
 * Endpoints admin del CMS.
 *
 * --------------------------------------------------------------------
 * PAQUETE 1 (ADR-025): NEUTRALIZADO.
 *
 * Los endpoints quedan declarados con sus paths originales para
 * preservar el contrato de URL mientras paquete 2-3 reescribe el
 * dominio. Todas las invocaciones lanzan UnsupportedOperationException
 * (Spring lo mapea a 500). Ventana de ruptura funcional acotada al
 * intervalo paquete 1 → paquete 2; el frontend admin recibira errores
 * 500 durante ese tiempo, comportamiento esperado.
 * --------------------------------------------------------------------
 */
@RestController
@RequestMapping("/api/admin/content")
public class ContentAdminController {

    private static final String MSG =
            "Pendiente paquete 2 — rediseño CMS bilingüe (ADR-025)";

    @GetMapping("/articles")
    public Map<String, Object> listArticles(
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String locale,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        throw new UnsupportedOperationException(MSG);
    }

    @GetMapping("/articles/{id}")
    public ArticleDetailDTO getArticle(@PathVariable("id") Long articleId) {
        throw new UnsupportedOperationException(MSG);
    }

    @PostMapping("/articles")
    public ResponseEntity<ArticleDetailDTO> createArticle(
            @RequestBody ArticleCreateRequest request,
            Authentication authentication
    ) {
        throw new UnsupportedOperationException(MSG);
    }

    @PatchMapping("/articles/{id}")
    public ArticleDetailDTO updateArticle(
            @PathVariable("id") Long articleId,
            @RequestBody ArticleUpdateRequest request,
            Authentication authentication
    ) {
        throw new UnsupportedOperationException(MSG);
    }

    @DeleteMapping("/articles/{id}")
    public ResponseEntity<Void> deleteArticle(
            @PathVariable("id") Long articleId,
            Authentication authentication
    ) {
        throw new UnsupportedOperationException(MSG);
    }

    @GetMapping(value = "/articles/{id}/body", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> getArticleBody(@PathVariable("id") Long articleId) {
        throw new UnsupportedOperationException(MSG);
    }

    @GetMapping("/articles/{id}/preview")
    public ArticlePublicDetailDTO previewArticle(@PathVariable("id") Long articleId) {
        throw new UnsupportedOperationException(MSG);
    }

    @PutMapping(value = "/articles/{id}/body", consumes = MediaType.TEXT_PLAIN_VALUE)
    public Map<String, Object> putArticleBody(
            @PathVariable("id") Long articleId,
            @RequestBody(required = false) String markdown,
            Authentication authentication
    ) {
        throw new UnsupportedOperationException(MSG);
    }

    @PostMapping("/articles/{id}/transition")
    public ArticleDetailDTO transitionArticle(
            @PathVariable("id") Long articleId,
            @RequestBody TransitionRequest request,
            Authentication authentication
    ) {
        throw new UnsupportedOperationException(MSG);
    }

    @GetMapping("/articles/{id}/versions")
    public List<VersionDTO> listVersions(@PathVariable("id") Long articleId) {
        throw new UnsupportedOperationException(MSG);
    }

    @GetMapping(value = "/articles/{id}/versions/{versionNumber}/body",
                produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> getVersionBody(
            @PathVariable("id") Long articleId,
            @PathVariable("versionNumber") Integer versionNumber
    ) {
        throw new UnsupportedOperationException(MSG);
    }

    @GetMapping("/articles/{id}/events")
    public Map<String, Object> listEvents(
            @PathVariable("id") Long articleId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        throw new UnsupportedOperationException(MSG);
    }
}
