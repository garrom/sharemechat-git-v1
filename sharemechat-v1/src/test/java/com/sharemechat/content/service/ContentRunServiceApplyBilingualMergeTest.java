package com.sharemechat.content.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sharemechat.content.constants.ContentConstants;
import com.sharemechat.content.dto.ApplyBilingualResultDTO;
import com.sharemechat.content.dto.ArticleDetailDTO;
import com.sharemechat.content.dto.ValidationErrorDTO;
import com.sharemechat.content.entity.ContentArticle;
import com.sharemechat.content.entity.ContentArticleTranslation;
import com.sharemechat.content.entity.ContentGenerationRun;
import com.sharemechat.content.repository.ContentArticleRepository;
import com.sharemechat.content.repository.ContentGenerationRunRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitarios ADR-045 subpasada 2A: gate ES en {@code createRun} y las
 * cuatro ramas de merge D4 en {@code applyBilingual}.
 *
 * Estrategia: mockeo completo de {@link ContentArticleService} para tener
 * control fino sobre el estado operador (parseTargetKeywords, findTranslation)
 * y sobre los side-effects (uploadTranslationDraftBody, saveTranslation, etc.).
 * Un helper con ContentArticleService real (con repos null) delega la
 * implementacion de {@code parseTargetKeywords} al codigo de produccion para
 * que el service bajo test vea el comportamiento real de parseo defensivo.
 *
 * Casos de merge cubiertos (ADR-045 D4):
 *  1. operador vacio + IA propone -> acepta IA (source ai_derived).
 *  2. operador poblado + IA respeta -> mantiene operador (source operator).
 *  3. operador poblado + IA sustituye -> REJECTED con error especifico.
 *  4. operador poblado + IA no propone type=primary -> mantiene operador
 *     sin drama (extra matiz operador).
 */
class ContentRunServiceApplyBilingualMergeTest {

    private ContentRunService runService;
    private ContentArticleRepository articleRepo;
    private ContentGenerationRunRepository runRepo;
    private ContentBodyStorageService bodyStorage;
    private ContentAIProvider aiProvider;
    private ContentArticleService articleService;
    private ObjectMapper mapper;
    private ContentArticleService realHelper;

    @BeforeEach
    void setup() {
        articleRepo = mock(ContentArticleRepository.class);
        runRepo = mock(ContentGenerationRunRepository.class);
        bodyStorage = mock(ContentBodyStorageService.class);
        aiProvider = mock(ContentAIProvider.class);
        articleService = mock(ContentArticleService.class);
        mapper = new ObjectMapper();
        // Instancia real ContentArticleService con repos null: solo se usa como
        // delegate para invocar parseTargetKeywords del codigo de produccion.
        realHelper = new ContentArticleService(null, null, null, null, null,
                null, null, null, mapper);

        runService = new ContentRunService(articleRepo, runRepo, bodyStorage,
                aiProvider, articleService, mapper);

        // Delegate parseTargetKeywords al comportamiento real de production.
        when(articleService.parseTargetKeywords(any()))
                .thenAnswer(inv -> realHelper.parseTargetKeywords(inv.getArgument(0)));
    }

    // ================================================================
    // Gate ES en createRun (ADR-045 D3)
    // ================================================================

    @Test
    void createRun_withoutPrimaryEs_bubblesUp409FromGate() {
        ContentArticle art = new ContentArticle();
        art.setId(1L);
        art.setState(ContentConstants.STATE_DRAFT);
        when(articleRepo.findById(1L)).thenReturn(Optional.of(art));
        // Gate lanza 409: primary ES no declarada.
        org.mockito.Mockito.doThrow(new ResponseStatusException(
                org.springframework.http.HttpStatus.CONFLICT,
                "Pendiente para lanzar run IA: locales.es.primary_keyword"))
                .when(articleService).assertPrimaryKeywordEsPresent(1L);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> runService.createRun(1L, ContentConstants.RUN_TYPE_FULL_ARTICLE_ORCHESTRATED, 42L));
        assertEquals(409, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("locales.es.primary_keyword"));
        verify(articleService, times(1)).assertPrimaryKeywordEsPresent(1L);
    }

    // ================================================================
    // applyBilingual — 4 casos de merge D4
    // ================================================================

    /** Caso 1: operador vacio + IA propone primary. Fuente esperada: "ai_derived". */
    @Test
    void applyBilingual_operatorEmpty_iaProposes_acceptsIa() throws Exception {
        String iaJson = buildValidAiJson("foo-es", "foo-en", "slug-es", "slug-en");
        ContentArticleTranslation esTr = translation(ContentConstants.LOCALE_ES, null);
        ContentArticleTranslation enTr = translation(ContentConstants.LOCALE_EN, null);
        setupApplyBilingualCommonMocks(iaJson, esTr, enTr);

        ApplyBilingualResultDTO result = invokeApplyBilingual(iaJson);

        assertNotNull(result.runDetail());
        assertEquals(ContentConstants.RUN_STATUS_VALIDATED, result.runDetail().status());
        // La primary aplicada viene de la IA.
        assertTrue(esTr.getTargetKeywords().contains("\"foo-es\""));
        assertTrue(esTr.getTargetKeywords().contains("\"primary\""));
        assertTrue(enTr.getTargetKeywords().contains("\"foo-en\""));
        // Payload event contiene ai_derived en ambos locales.
        org.mockito.ArgumentCaptor<java.util.Map<String, Object>> payloadCaptor =
                org.mockito.ArgumentCaptor.forClass(java.util.Map.class);
        verify(articleService).emitEventPublic(anyLong(), any(), anyString(), anyLong(),
                payloadCaptor.capture());
        @SuppressWarnings("unchecked")
        java.util.Map<String, String> sources = (java.util.Map<String, String>)
                payloadCaptor.getValue().get("primary_keyword_sources");
        assertEquals("ai_derived", sources.get(ContentConstants.LOCALE_ES));
        assertEquals("ai_derived", sources.get(ContentConstants.LOCALE_EN));
    }

    /** Caso 2: operador poblado + IA respeta. Fuente esperada: "operator". */
    @Test
    void applyBilingual_operatorPopulated_iaRespects_keepsOperator() throws Exception {
        String iaJson = buildValidAiJson("foo-es", "foo-en", "slug-es", "slug-en");
        String opEsJson = "[{\"term\":\"foo-es\",\"type\":\"primary\"}]";
        String opEnJson = "[{\"term\":\"foo-en\",\"type\":\"primary\"}]";
        ContentArticleTranslation esTr = translation(ContentConstants.LOCALE_ES, opEsJson);
        ContentArticleTranslation enTr = translation(ContentConstants.LOCALE_EN, opEnJson);
        setupApplyBilingualCommonMocks(iaJson, esTr, enTr);

        ApplyBilingualResultDTO result = invokeApplyBilingual(iaJson);

        assertEquals(ContentConstants.RUN_STATUS_VALIDATED, result.runDetail().status());
        assertTrue(esTr.getTargetKeywords().contains("\"foo-es\""));
        assertTrue(enTr.getTargetKeywords().contains("\"foo-en\""));
        // Fuente = operator.
        java.util.Map<String, String> sources = capturePrimarySources();
        assertEquals("operator", sources.get(ContentConstants.LOCALE_ES));
        assertEquals("operator", sources.get(ContentConstants.LOCALE_EN));
    }

    /** Caso 3: operador poblado + IA propone distinta -> REJECTED con mensaje especifico. */
    @Test
    void applyBilingual_operatorPopulated_iaSubstitutes_rejectsWithSpecificMessage() throws Exception {
        String iaJson = buildValidAiJson("bar-es", "foo-en", "slug-es", "slug-en");
        String opEsJson = "[{\"term\":\"foo-es\",\"type\":\"primary\"}]";
        String opEnJson = "[{\"term\":\"foo-en\",\"type\":\"primary\"}]";
        ContentArticleTranslation esTr = translation(ContentConstants.LOCALE_ES, opEsJson);
        ContentArticleTranslation enTr = translation(ContentConstants.LOCALE_EN, opEnJson);
        setupApplyBilingualCommonMocks(iaJson, esTr, enTr);

        ApplyBilingualResultDTO result = invokeApplyBilingual(iaJson);

        assertEquals(ContentConstants.RUN_STATUS_REJECTED, result.runDetail().status());
        assertNull(result.article(), "En REJECTED no debe devolverse article");
        List<ValidationErrorDTO> errors = result.runDetail().validationErrors();
        assertFalse(errors.isEmpty());
        ValidationErrorDTO first = errors.get(0);
        assertEquals("locales.es.target_keywords", first.field());
        assertTrue(first.message().contains("'bar-es'"),
                "mensaje debe mencionar el termino propuesto por la IA");
        assertTrue(first.message().contains("'foo-es'"),
                "mensaje debe mencionar el termino declarado por el operador");
        assertTrue(first.message().contains("ES"),
                "mensaje debe identificar el locale afectado");
        assertTrue(first.message().contains("honrar la keyword del operador"),
                "mensaje debe ser accionable ADR-045 D4");
    }

    /** Caso 4 (extra): operador poblado + IA no propone type=primary -> mantiene operador sin drama. */
    @Test
    void applyBilingual_operatorPopulated_iaOmitsPrimary_keepsOperatorSilently() throws Exception {
        // Aunque el adapter exige type=primary, este test verifica el comportamiento
        // del service cuando por manipulacion externa o cambio futuro del adapter
        // llega un array sin type=primary. La primary del operador se preserva.
        String iaJson = buildAiJsonWithNoPrimary("slug-es", "slug-en");
        String opEsJson = "[{\"term\":\"foo-es\",\"type\":\"primary\"}]";
        String opEnJson = "[{\"term\":\"foo-en\",\"type\":\"primary\"}]";
        ContentArticleTranslation esTr = translation(ContentConstants.LOCALE_ES, opEsJson);
        ContentArticleTranslation enTr = translation(ContentConstants.LOCALE_EN, opEnJson);
        setupApplyBilingualCommonMocks(iaJson, esTr, enTr);

        ApplyBilingualResultDTO result = invokeApplyBilingual(iaJson);

        assertEquals(ContentConstants.RUN_STATUS_VALIDATED, result.runDetail().status());
        assertTrue(esTr.getTargetKeywords().contains("\"foo-es\""),
                "primary del operador debe preservarse");
        assertTrue(enTr.getTargetKeywords().contains("\"foo-en\""),
                "primary del operador debe preservarse");
        java.util.Map<String, String> sources = capturePrimarySources();
        assertEquals("operator", sources.get(ContentConstants.LOCALE_ES));
        assertEquals("operator", sources.get(ContentConstants.LOCALE_EN));
    }

    // ================================================================
    // Helpers de test
    // ================================================================

    private ApplyBilingualResultDTO invokeApplyBilingual(String iaJson) {
        return runService.applyBilingual(
                1L,                            // articleId
                10L,                           // runId
                iaJson,                        // rawJson
                "claude-opus-4-8",             // modelId (whitelisted)
                null,                          // modelVersion
                42L,                           // actorUserId
                true);                         // isAdmin
    }

    private ContentArticleTranslation translation(String locale, String targetKeywordsJson) {
        ContentArticleTranslation tr = new ContentArticleTranslation();
        tr.setArticleId(1L);
        tr.setLocale(locale);
        tr.setSlug("slug-" + locale);
        tr.setTitle("title " + locale);
        tr.setSeoTitle("seo " + locale);
        tr.setMetaDescription("meta " + locale);
        tr.setBrief("brief " + locale);
        tr.setTargetKeywords(targetKeywordsJson);
        return tr;
    }

    private void setupApplyBilingualCommonMocks(String iaJson, ContentArticleTranslation esTr,
                                                ContentArticleTranslation enTr) throws Exception {
        ContentArticle art = new ContentArticle();
        art.setId(1L);
        art.setState(ContentConstants.STATE_DRAFT);
        ContentGenerationRun run = new ContentGenerationRun();
        run.setId(10L);
        run.setArticleId(1L);
        run.setStatus(ContentConstants.RUN_STATUS_PENDING);
        run.setPromptTemplateId(ContentConstants.RUN_TYPE_FULL_ARTICLE_ORCHESTRATED + "/v1");

        when(runRepo.findById(10L)).thenReturn(Optional.of(run));
        when(articleService.requireEditable(eq(1L), anyBoolean())).thenReturn(art);
        when(aiProvider.isModelAllowed(anyString())).thenReturn(true);
        when(aiProvider.validateOutput(anyString(), anyString()))
                .thenReturn(new ContentAIProvider.OutputValidationResult(true, List.of(), iaJson));

        when(bodyStorage.uploadRunOutputRaw(anyLong(), any(byte[].class))).thenReturn("runs/10/output_raw.md");
        when(articleService.uploadTranslationDraftBody(anyLong(), anyString(), anyString()))
                .thenAnswer(inv -> {
                    String loc = inv.getArgument(1);
                    return new ContentBodyStorageService.Result(
                            "articles/1/" + loc + "/draft.md", "hash-" + loc, 1024);
                });
        // uploadRunOutputValidated y uploadRunValidationErrors devuelven String;
        // Mockito devuelve null por defecto, suficiente para el flujo bajo test.

        when(articleService.requireTranslation(1L, ContentConstants.LOCALE_ES)).thenReturn(esTr);
        when(articleService.findOrCreateTranslation(1L, ContentConstants.LOCALE_EN)).thenReturn(enTr);
        when(articleService.findTranslation(1L, ContentConstants.LOCALE_ES)).thenReturn(Optional.of(esTr));
        when(articleService.findTranslation(1L, ContentConstants.LOCALE_EN)).thenReturn(Optional.of(enTr));
        when(articleService.saveTranslation(any())).thenAnswer(inv -> inv.getArgument(0));
        when(articleService.saveArticle(any())).thenAnswer(inv -> inv.getArgument(0));
        when(runRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(articleService.toDetail(any())).thenReturn(mock(ArticleDetailDTO.class));
        // assertSlugAvailableForLocale es void; no requiere stub explicito.
    }

    @SuppressWarnings("unchecked")
    private java.util.Map<String, String> capturePrimarySources() {
        org.mockito.ArgumentCaptor<java.util.Map<String, Object>> payloadCaptor =
                org.mockito.ArgumentCaptor.forClass(java.util.Map.class);
        verify(articleService).emitEventPublic(anyLong(), any(), anyString(), anyLong(),
                payloadCaptor.capture());
        return (java.util.Map<String, String>)
                payloadCaptor.getValue().get("primary_keyword_sources");
    }

    /**
     * JSON canonico minimo con estructura shared + locales.{es,en}. El adapter no
     * lo re-valida en el test (validateOutput esta mockeado); solo importa el
     * shape que aplyBilingual consume tras el mock.
     */
    private String buildValidAiJson(String primaryEs, String primaryEn,
                                    String slugEs, String slugEn) {
        return "{"
                + "\"schema_version\":\"2.0\","
                + "\"run_type\":\"FULL_ARTICLE_ORCHESTRATED\","
                + "\"shared\":{"
                +   "\"category\":\"safety\","
                +   "\"self_check_passed\":true,"
                +   "\"sources_used\":[]"
                + "},"
                + "\"locales\":{"
                +   "\"es\":" + localeNode(slugEs, primaryEs) + ","
                +   "\"en\":" + localeNode(slugEn, primaryEn)
                + "}}";
    }

    private String buildAiJsonWithNoPrimary(String slugEs, String slugEn) {
        return "{"
                + "\"schema_version\":\"2.0\","
                + "\"run_type\":\"FULL_ARTICLE_ORCHESTRATED\","
                + "\"shared\":{"
                +   "\"category\":\"safety\","
                +   "\"self_check_passed\":true,"
                +   "\"sources_used\":[]"
                + "},"
                + "\"locales\":{"
                +   "\"es\":" + localeNodeSecondaryOnly(slugEs) + ","
                +   "\"en\":" + localeNodeSecondaryOnly(slugEn)
                + "}}";
    }

    private String localeNode(String slug, String primaryTerm) {
        return "{"
                + "\"slug\":\"" + slug + "\","
                + "\"title\":\"t\","
                + "\"seo_title\":\"s\","
                + "\"meta_description\":\"m\","
                + "\"brief\":\"b\","
                + "\"draft_markdown\":\"## body\","
                + "\"target_keywords\":[{\"term\":\"" + primaryTerm + "\",\"type\":\"primary\",\"search_intent_match\":\"informational\"}]"
                + "}";
    }

    private String localeNodeSecondaryOnly(String slug) {
        return "{"
                + "\"slug\":\"" + slug + "\","
                + "\"title\":\"t\","
                + "\"seo_title\":\"s\","
                + "\"meta_description\":\"m\","
                + "\"brief\":\"b\","
                + "\"draft_markdown\":\"## body\","
                + "\"target_keywords\":[{\"term\":\"otra\",\"type\":\"secondary\"}]"
                + "}";
    }
}
