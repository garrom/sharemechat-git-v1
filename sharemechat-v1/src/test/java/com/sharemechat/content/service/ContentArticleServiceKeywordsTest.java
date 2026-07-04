package com.sharemechat.content.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sharemechat.content.constants.ContentConstants;
import com.sharemechat.content.entity.ContentArticleTranslation;
import com.sharemechat.content.repository.ContentArticleTranslationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Tests unitarios ADR-045 subpasada 2A: normalizacion + composicion + parseo
 * defensivo de keywords SEO + gate ES en {@code assertPrimaryKeywordEsPresent}.
 *
 * Los tests que solo invocan utilidades puras (normalizacion, composicion,
 * parseo) crean el service con {@code null} en los repos no usados. Los tests
 * del gate mockean solo {@code translationRepo}.
 */
class ContentArticleServiceKeywordsTest {

    private ContentArticleService service;
    private ContentArticleTranslationRepository translationRepo;

    @BeforeEach
    void setup() {
        translationRepo = mock(ContentArticleTranslationRepository.class);
        service = new ContentArticleService(
                null,                 // articleRepo
                translationRepo,      // translationRepo (solo usado por assertPrimaryKeywordEsPresent)
                null,                 // versionRepo
                null,                 // translationVersionRepo
                null,                 // eventRepo
                null,                 // bodyStorageService
                null,                 // markdownRenderer
                null,                 // publicSiteProperties
                new ObjectMapper()
        );
    }

    // ================================================================
    // normalizePrimaryKeyword
    // ================================================================

    @Test
    void normalizePrimaryKeyword_null_returnsNull() {
        assertNull(service.normalizePrimaryKeyword(null));
    }

    @Test
    void normalizePrimaryKeyword_blank_returnsNull() {
        assertNull(service.normalizePrimaryKeyword(""));
        assertNull(service.normalizePrimaryKeyword("   "));
    }

    @Test
    void normalizePrimaryKeyword_trimsAndKeeps() {
        assertEquals("video chat", service.normalizePrimaryKeyword("  video chat  "));
    }

    @Test
    void normalizePrimaryKeyword_preservesCase() {
        assertEquals("Video Chat", service.normalizePrimaryKeyword("Video Chat"));
    }

    @Test
    void normalizePrimaryKeyword_tooLong_throws400() {
        String tooLong = "a".repeat(121);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.normalizePrimaryKeyword(tooLong));
        assertEquals(400, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("primaryKeyword"));
    }

    // ================================================================
    // normalizeSecondaryKeywords
    // ================================================================

    @Test
    void normalizeSecondaryKeywords_null_returnsEmpty() {
        assertEquals(List.of(), service.normalizeSecondaryKeywords(null));
    }

    @Test
    void normalizeSecondaryKeywords_blank_returnsEmpty() {
        assertEquals(List.of(), service.normalizeSecondaryKeywords(""));
        assertEquals(List.of(), service.normalizeSecondaryKeywords("   "));
    }

    @Test
    void normalizeSecondaryKeywords_trimsEachElement() {
        assertEquals(List.of("a", "b", "c"),
                service.normalizeSecondaryKeywords(" a , b , c "));
    }

    @Test
    void normalizeSecondaryKeywords_dedupCaseInsensitive() {
        // La primera aparicion se preserva con su case original.
        assertEquals(List.of("Alpha", "beta"),
                service.normalizeSecondaryKeywords("Alpha, beta, alpha, ALPHA"));
    }

    @Test
    void normalizeSecondaryKeywords_capAtFive() {
        // Los extras se descartan silenciosamente conservando los primeros.
        assertEquals(List.of("a", "b", "c", "d", "e"),
                service.normalizeSecondaryKeywords("a,b,c,d,e,f,g"));
    }

    @Test
    void normalizeSecondaryKeywords_ignoresEmptyBetweenCommas() {
        assertEquals(List.of("a", "b"),
                service.normalizeSecondaryKeywords("a,,b,   ,"));
    }

    @Test
    void normalizeSecondaryKeywords_tooLongItem_throws400() {
        String csv = "ok, " + "x".repeat(121);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.normalizeSecondaryKeywords(csv));
        assertEquals(400, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("secondaryKeywords"));
    }

    // ================================================================
    // parseTargetKeywords (derivacion DEFENSIVA — matiz operador)
    // ================================================================

    @Test
    void parseTargetKeywords_null_returnsEmptyDefensive() {
        ContentArticleService.ParsedTargetKeywords parsed = service.parseTargetKeywords(null);
        assertNull(parsed.primary());
        assertTrue(parsed.secondaries().isEmpty());
    }

    @Test
    void parseTargetKeywords_blank_returnsEmptyDefensive() {
        ContentArticleService.ParsedTargetKeywords parsed = service.parseTargetKeywords("   ");
        assertNull(parsed.primary());
        assertTrue(parsed.secondaries().isEmpty());
    }

    @Test
    void parseTargetKeywords_malformedJson_returnsEmptyDefensive() {
        ContentArticleService.ParsedTargetKeywords parsed = service.parseTargetKeywords("{not valid json[");
        assertNull(parsed.primary());
        assertTrue(parsed.secondaries().isEmpty());
    }

    @Test
    void parseTargetKeywords_notArray_returnsEmptyDefensive() {
        // Si el JSON es un objeto en vez de array (posible corrupcion), fallback silencioso.
        ContentArticleService.ParsedTargetKeywords parsed = service.parseTargetKeywords("{\"term\":\"x\"}");
        assertNull(parsed.primary());
        assertTrue(parsed.secondaries().isEmpty());
    }

    @Test
    void parseTargetKeywords_wellFormed_extractsPrimaryAndSecondaries() {
        String json = "["
                + "{\"term\":\"video chat\",\"type\":\"primary\",\"search_intent_match\":\"informational\"},"
                + "{\"term\":\"live chat\",\"type\":\"secondary\",\"search_intent_match\":null},"
                + "{\"term\":\"camchat\",\"type\":\"secondary\"}"
                + "]";
        ContentArticleService.ParsedTargetKeywords parsed = service.parseTargetKeywords(json);
        assertEquals("video chat", parsed.primary());
        assertEquals(List.of("live chat", "camchat"), parsed.secondaries());
    }

    @Test
    void parseTargetKeywords_missingType_skipsEntry() {
        // Objetos sin type valido se descartan defensivamente.
        String json = "["
                + "{\"term\":\"foo\"},"
                + "{\"type\":\"primary\"},"
                + "{\"term\":\"bar\",\"type\":\"primary\"}"
                + "]";
        ContentArticleService.ParsedTargetKeywords parsed = service.parseTargetKeywords(json);
        assertEquals("bar", parsed.primary());
    }

    @Test
    void parseTargetKeywords_multiplePrimaries_keepsFirst() {
        String json = "["
                + "{\"term\":\"first\",\"type\":\"primary\"},"
                + "{\"term\":\"second\",\"type\":\"primary\"}"
                + "]";
        ContentArticleService.ParsedTargetKeywords parsed = service.parseTargetKeywords(json);
        assertEquals("first", parsed.primary());
    }

    // ================================================================
    // composeTargetKeywordsJson
    // ================================================================

    @Test
    void composeTargetKeywordsJson_nullAll_returnsNull() {
        assertNull(service.composeTargetKeywordsJson(null, List.of(), null));
    }

    @Test
    void composeTargetKeywordsJson_onlyPrimary_producesArray() {
        String json = service.composeTargetKeywordsJson("foo", List.of(), null);
        assertNotNull(json);
        ContentArticleService.ParsedTargetKeywords rt = service.parseTargetKeywords(json);
        assertEquals("foo", rt.primary());
        assertTrue(rt.secondaries().isEmpty());
    }

    @Test
    void composeTargetKeywordsJson_primaryAndSecondaries_orderPreserved() {
        String json = service.composeTargetKeywordsJson("primary-term",
                List.of("sec1", "sec2", "sec3"), null);
        assertNotNull(json);
        ContentArticleService.ParsedTargetKeywords rt = service.parseTargetKeywords(json);
        assertEquals("primary-term", rt.primary());
        assertEquals(List.of("sec1", "sec2", "sec3"), rt.secondaries());
    }

    @Test
    void composeTargetKeywordsJson_preservesIntentMatchFromExisting() {
        // Cuando el previo (existingJson) tiene search_intent_match y el termino
        // coincide, se preserva en el nuevo JSON.
        String previous = "[{\"term\":\"foo\",\"type\":\"primary\",\"search_intent_match\":\"informational\"}]";
        String json = service.composeTargetKeywordsJson("foo", List.of(), previous);
        assertTrue(json.contains("\"search_intent_match\":\"informational\""));
    }

    @Test
    void composeTargetKeywordsJson_intentNullWhenTermChanges() {
        // Si el termino primary cambia, no se preserva el intent del anterior.
        String previous = "[{\"term\":\"foo\",\"type\":\"primary\",\"search_intent_match\":\"informational\"}]";
        String json = service.composeTargetKeywordsJson("bar", List.of(), previous);
        assertTrue(json.contains("\"search_intent_match\":null"));
    }

    // ================================================================
    // assertPrimaryKeywordEsPresent (gate ADR-045 D3 en createRun)
    // ================================================================

    @Test
    void assertPrimaryKeywordEsPresent_nullArticleId_returnsSilently() {
        // Contrato defensivo: articleId null no debe lanzar (no hay nada que validar).
        assertDoesNotThrow(() -> service.assertPrimaryKeywordEsPresent(null));
    }

    @Test
    void assertPrimaryKeywordEsPresent_missingTranslation_throws409() {
        when(translationRepo.findByArticleIdAndLocale(anyLong(), eq(ContentConstants.LOCALE_ES)))
                .thenReturn(Optional.empty());
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.assertPrimaryKeywordEsPresent(1L));
        assertEquals(409, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("traduccion es no existe"));
    }

    @Test
    void assertPrimaryKeywordEsPresent_emptyTargetKeywords_throws409() {
        ContentArticleTranslation tr = new ContentArticleTranslation();
        tr.setLocale(ContentConstants.LOCALE_ES);
        tr.setTargetKeywords(null); // sin keywords operador declaradas
        when(translationRepo.findByArticleIdAndLocale(anyLong(), eq(ContentConstants.LOCALE_ES)))
                .thenReturn(Optional.of(tr));
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.assertPrimaryKeywordEsPresent(1L));
        assertEquals(409, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("locales.es.primary_keyword"));
    }

    @Test
    void assertPrimaryKeywordEsPresent_targetKeywordsWithoutPrimary_throws409() {
        // Corner case: array target_keywords con solo secondaries (no cumple D2
        // pero puede darse por manipulacion externa). El gate lo bloquea.
        ContentArticleTranslation tr = new ContentArticleTranslation();
        tr.setLocale(ContentConstants.LOCALE_ES);
        tr.setTargetKeywords("[{\"term\":\"sec\",\"type\":\"secondary\"}]");
        when(translationRepo.findByArticleIdAndLocale(anyLong(), eq(ContentConstants.LOCALE_ES)))
                .thenReturn(Optional.of(tr));
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.assertPrimaryKeywordEsPresent(1L));
        assertEquals(409, ex.getStatusCode().value());
    }

    @Test
    void assertPrimaryKeywordEsPresent_presentPrimary_ok() {
        ContentArticleTranslation tr = new ContentArticleTranslation();
        tr.setLocale(ContentConstants.LOCALE_ES);
        tr.setTargetKeywords("[{\"term\":\"foo\",\"type\":\"primary\"}]");
        when(translationRepo.findByArticleIdAndLocale(anyLong(), eq(ContentConstants.LOCALE_ES)))
                .thenReturn(Optional.of(tr));
        assertDoesNotThrow(() -> service.assertPrimaryKeywordEsPresent(1L));
    }
}
