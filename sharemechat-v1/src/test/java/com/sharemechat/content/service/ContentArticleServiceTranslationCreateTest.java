package com.sharemechat.content.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sharemechat.content.constants.ContentConstants;
import com.sharemechat.content.dto.TranslationCreateRequest;
import com.sharemechat.content.dto.TranslationDetailDTO;
import com.sharemechat.content.entity.ContentArticle;
import com.sharemechat.content.entity.ContentArticleTranslation;
import com.sharemechat.content.repository.ContentArticleRepository;
import com.sharemechat.content.repository.ContentArticleTranslationRepository;
import com.sharemechat.content.repository.ContentReviewEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Tests unitarios ADR-045 subpasada 2C.0: endpoint POST translations que
 * cierra known-debt #D-8 (bootstrap translation EN antes del primer
 * apply-bilingual) + fix del {@code updateTranslationBody} para devolver
 * 404 accionable en lugar de 500 opaco cuando la translation no existe.
 *
 * Mockeo mínimo: articleRepo, translationRepo, eventRepo. El resto de deps
 * puede ir null porque los métodos bajo test no los tocan.
 */
class ContentArticleServiceTranslationCreateTest {

    private ContentArticleService service;
    private ContentArticleRepository articleRepo;
    private ContentArticleTranslationRepository translationRepo;
    private ContentReviewEventRepository eventRepo;

    @BeforeEach
    void setup() {
        articleRepo = mock(ContentArticleRepository.class);
        translationRepo = mock(ContentArticleTranslationRepository.class);
        eventRepo = mock(ContentReviewEventRepository.class);
        service = new ContentArticleService(
                articleRepo,
                translationRepo,
                null, null,             // versionRepo, translationVersionRepo
                eventRepo,
                null,                   // bodyStorageService
                null,                   // markdownRenderer
                null,                   // publicSiteProperties
                new ObjectMapper()
        );

        // Save devuelve la entity con id 100 asignado; suficiente para el mapper.
        when(translationRepo.save(any())).thenAnswer(inv -> {
            ContentArticleTranslation t = inv.getArgument(0);
            t.setId(100L);
            return t;
        });
        when(articleRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    // ================================================================
    // Test 1 — creación válida sin keywords
    // ================================================================
    @Test
    void createTranslation_validNoKeywords_returns201Dto() {
        stubArticleDraft(1L);
        when(translationRepo.findByArticleIdAndLocale(1L, "en")).thenReturn(Optional.empty());
        when(translationRepo.findBySlugAndLocale(anyString(), eq("en"))).thenReturn(Optional.empty());

        TranslationCreateRequest req = new TranslationCreateRequest();
        req.setLocale("en");
        req.setSlug("safe-adult-video-chat");
        req.setTitle("Safe adult video chat: guide");

        TranslationDetailDTO dto = service.createTranslation(1L, req, 42L, false);

        assertNotNull(dto);
        assertEquals("en", dto.locale());
        assertEquals("safe-adult-video-chat", dto.slug());
        assertEquals("Safe adult video chat: guide", dto.title());
        assertNull(dto.targetKeywords(), "sin primary/secondaries, targetKeywords queda null");
        assertNull(dto.primaryKeyword());
        assertTrue(dto.secondaryKeywords().isEmpty());
    }

    // ================================================================
    // Test 2 — locale ya existente → 409
    // ================================================================
    @Test
    void createTranslation_localeAlreadyExists_throws409() {
        stubArticleDraft(1L);
        ContentArticleTranslation existing = new ContentArticleTranslation();
        existing.setLocale("en");
        when(translationRepo.findByArticleIdAndLocale(1L, "en")).thenReturn(Optional.of(existing));

        TranslationCreateRequest req = validReq("en", "safe-slug", "Title");

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.createTranslation(1L, req, 42L, true));
        assertEquals(409, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("Ya existe traduccion locale='en'"));
        assertTrue(ex.getReason().contains("PATCH"));
    }

    // ================================================================
    // Test 3 — slug duplicado global en otro artículo → 409
    // ================================================================
    @Test
    void createTranslation_slugDuplicatedInOtherArticle_throws409() {
        stubArticleDraft(1L);
        when(translationRepo.findByArticleIdAndLocale(1L, "en")).thenReturn(Optional.empty());
        // Slug ya existe en otro artículo del mismo locale.
        ContentArticleTranslation other = new ContentArticleTranslation();
        other.setId(999L);
        other.setArticleId(999L);
        when(translationRepo.findBySlugAndLocale("dup-slug", "en")).thenReturn(Optional.of(other));

        TranslationCreateRequest req = validReq("en", "dup-slug", "Title");

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.createTranslation(1L, req, 42L, true));
        assertEquals(409, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("slug='dup-slug'"));
    }

    // ================================================================
    // Test 4 — con primary + secondaries → targetKeywords JSON canonical
    // ================================================================
    @Test
    void createTranslation_withPrimaryAndSecondaries_persistsCanonicalJson() {
        stubArticleDraft(1L);
        when(translationRepo.findByArticleIdAndLocale(1L, "en")).thenReturn(Optional.empty());
        when(translationRepo.findBySlugAndLocale(anyString(), eq("en"))).thenReturn(Optional.empty());

        TranslationCreateRequest req = validReq("en", "safe-slug", "Title");
        req.setPrimaryKeyword("safe adult video chat");
        req.setSecondaryKeywords("verified cam models, private 1v1, adult webcam");

        TranslationDetailDTO dto = service.createTranslation(1L, req, 42L, true);

        assertNotNull(dto.targetKeywords(), "JSON canonico debe emitirse");
        assertTrue(dto.targetKeywords().contains("\"safe adult video chat\""));
        assertTrue(dto.targetKeywords().contains("\"type\":\"primary\""));
        assertEquals("safe adult video chat", dto.primaryKeyword());
        assertEquals(3, dto.secondaryKeywords().size());
    }

    // ================================================================
    // Test 5 — sin primary/secondaries → targetKeywords NULL
    // ================================================================
    @Test
    void createTranslation_noKeywords_targetKeywordsNull() {
        stubArticleDraft(1L);
        when(translationRepo.findByArticleIdAndLocale(1L, "en")).thenReturn(Optional.empty());
        when(translationRepo.findBySlugAndLocale(anyString(), eq("en"))).thenReturn(Optional.empty());

        TranslationCreateRequest req = validReq("en", "safe-slug", "Title");

        TranslationDetailDTO dto = service.createTranslation(1L, req, 42L, true);
        assertNull(dto.targetKeywords());
    }

    // ================================================================
    // Test 6 — locale fuera del set → 400
    // ================================================================
    @Test
    void createTranslation_unsupportedLocale_throws400() {
        stubArticleDraft(1L);
        TranslationCreateRequest req = validReq("fr", "some-slug", "Titre");

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.createTranslation(1L, req, 42L, true));
        assertEquals(400, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("locale no soportado"));
    }

    // ================================================================
    // Test 7 — slug null → 400
    // ================================================================
    @Test
    void createTranslation_slugNull_throws400() {
        stubArticleDraft(1L);
        TranslationCreateRequest req = new TranslationCreateRequest();
        req.setLocale("en");
        req.setTitle("Title");
        // slug NO seteado

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.createTranslation(1L, req, 42L, true));
        assertEquals(400, ex.getStatusCode().value());
        assertTrue(ex.getReason().toLowerCase().contains("slug"));
    }

    // ================================================================
    // Test 8 — title null → 400
    // ================================================================
    @Test
    void createTranslation_titleNull_throws400() {
        stubArticleDraft(1L);
        TranslationCreateRequest req = new TranslationCreateRequest();
        req.setLocale("en");
        req.setSlug("some-slug");
        // title NO seteado

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.createTranslation(1L, req, 42L, true));
        assertEquals(400, ex.getStatusCode().value());
        assertTrue(ex.getReason().toLowerCase().contains("title"));
    }

    // ================================================================
    // Test 9 — artículo PUBLISHED → 409 (no editable)
    // ================================================================
    @Test
    void createTranslation_articlePublished_throws409() {
        ContentArticle article = new ContentArticle();
        article.setId(1L);
        article.setState(ContentConstants.STATE_PUBLISHED);
        when(articleRepo.findById(1L)).thenReturn(Optional.of(article));

        TranslationCreateRequest req = validReq("en", "safe-slug", "Title");

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.createTranslation(1L, req, 42L, true));
        assertEquals(409, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("terminal"));
    }

    // ================================================================
    // Test 10 — regresión #D-8: updateTranslationBody sin translation → 404
    // accionable con mensaje literal del ADR-045 subpasada 2C.0.
    // Blinda el fix del bug latente descubierto en E2E de 2B (antes 500 opaco).
    // ================================================================
    @Test
    void updateTranslationBody_translationDoesNotExist_throws404WithActionableMessage() {
        stubArticleDraft(1L);
        when(translationRepo.findByArticleIdAndLocale(1L, "en")).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.updateTranslationBody(1L, "en",
                        "# body".getBytes(), 42L, true));
        assertEquals(404, ex.getStatusCode().value(),
                "Antes del fix devolvia 500 opaco por constraint violation; ahora 404 accionable");
        String reason = ex.getReason();
        assertTrue(reason.contains("Translation locale='en'"),
                "Debe mencionar el locale exacto");
        assertTrue(reason.contains("articleId=1"),
                "Debe mencionar el articleId exacto");
        assertTrue(reason.contains("POST /admin/content/articles/{articleId}/translations"),
                "Debe apuntar al endpoint nuevo introducido en 2C.0");
    }

    // ================================================================
    // Helpers
    // ================================================================

    private void stubArticleDraft(Long articleId) {
        ContentArticle article = new ContentArticle();
        article.setId(articleId);
        article.setState(ContentConstants.STATE_DRAFT);
        when(articleRepo.findById(articleId)).thenReturn(Optional.of(article));
    }

    private TranslationCreateRequest validReq(String locale, String slug, String title) {
        TranslationCreateRequest req = new TranslationCreateRequest();
        req.setLocale(locale);
        req.setSlug(slug);
        req.setTitle(title);
        return req;
    }
}
