package com.sharemechat.content.service;

import com.sharemechat.content.constants.ContentConstants;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests unitarios ADR-045 subpasada 2B: verifica que el prompt emitido incluye
 * los bloques {@code <locale_input>} per-locale con los valores esperados y
 * que {@code output_contract} y {@code self_check} contienen las reglas
 * nuevas de coherencia primary.
 *
 * El builder no depende de nada: se instancia con {@code new} y se llama
 * directamente. Los tests solo inspeccionan el String resultante.
 */
class ContentPromptBuilderTest {

    private ContentPromptBuilder builder;

    @BeforeEach
    void setup() {
        builder = new ContentPromptBuilder();
    }

    // ================================================================
    // Casos principales del prompt del operador
    // ================================================================

    @Test
    void caseA_primaryEnPopulated_emitsQuotedValueInEnBlock() {
        ContentAIProvider.PromptContext ctx = new ContentAIProvider.PromptContext(
                ContentConstants.RUN_TYPE_FULL_ARTICLE_ORCHESTRATED,
                42L,
                "safe-video-chat",
                "Videochat seguro",
                "Brief del articulo",
                "safety",
                null,                                 // keywordsJson (legacy, no se emite)
                "https://cdn/hero.png",
                ContentConstants.STATE_DRAFT,
                null,
                7L,
                new ContentAIProvider.LocaleKeywords("videochat seguro", List.of("chat webcam", "1v1 video")),
                new ContentAIProvider.LocaleKeywords("safe video chat", List.of("live cam chat"))
        );

        String prompt = builder.build(ContentConstants.RUN_TYPE_FULL_ARTICLE_ORCHESTRATED, ctx);

        assertTrue(prompt.contains("<locale_input locale=\"en\">"),
                "Debe emitir bloque <locale_input locale=\"en\">");
        assertTrue(prompt.contains("primary_keyword:    \"safe video chat\""),
                "primary_keyword EN populada debe ir entre comillas dobles");
        assertTrue(prompt.contains("secondary_keywords: [\"live cam chat\"]"),
                "secondary_keywords EN populadas deben ir en array con comillas");
    }

    @Test
    void caseB_primaryEnEmpty_emitsEmptyQuotedAndDerivationNote() {
        ContentAIProvider.PromptContext ctx = new ContentAIProvider.PromptContext(
                ContentConstants.RUN_TYPE_FULL_ARTICLE_ORCHESTRATED,
                42L,
                "safe-video-chat",
                "Videochat seguro",
                "Brief",
                "safety",
                null,
                "https://cdn/hero.png",
                ContentConstants.STATE_DRAFT,
                null,
                7L,
                new ContentAIProvider.LocaleKeywords("videochat seguro", List.of()),
                ContentAIProvider.LocaleKeywords.empty()  // EN vacio: primary null + secondaries []
        );

        String prompt = builder.build(ContentConstants.RUN_TYPE_FULL_ARTICLE_ORCHESTRATED, ctx);

        assertTrue(prompt.contains("<locale_input locale=\"en\">"));
        assertTrue(prompt.contains("primary_keyword:    \"\""),
                "primary EN vacia debe emitirse como par de comillas literales");
        assertTrue(prompt.contains("secondary_keywords: []"),
                "secondaries EN vacias deben emitirse como array vacio literal");
        assertTrue(prompt.contains("politica ADR-045 D3"),
                "Debe emitir la nota de politica dentro del bloque EN");
        assertTrue(prompt.contains("fase 4.5 los DERIVA del ES"),
                "Debe explicar el fallback de derivacion");
    }

    @Test
    void caseC_esWithMultipleSecondaries_emitsAllInQuotedArray() {
        List<String> secs = List.of("a", "b", "c", "d", "e");
        ContentAIProvider.PromptContext ctx = new ContentAIProvider.PromptContext(
                ContentConstants.RUN_TYPE_FULL_ARTICLE_ORCHESTRATED,
                42L,
                "primary-es-slug",
                "Titulo ES",
                "Brief ES",
                "safety",
                null,
                "https://cdn/hero.png",
                ContentConstants.STATE_DRAFT,
                null,
                7L,
                new ContentAIProvider.LocaleKeywords("primary es term", secs),
                ContentAIProvider.LocaleKeywords.empty()
        );

        String prompt = builder.build(ContentConstants.RUN_TYPE_FULL_ARTICLE_ORCHESTRATED, ctx);

        assertTrue(prompt.contains("<locale_input locale=\"es\">"));
        assertTrue(prompt.contains("primary_keyword:    \"primary es term\""));
        assertTrue(prompt.contains(
                "secondary_keywords: [\"a\", \"b\", \"c\", \"d\", \"e\"]"),
                "Los 5 secondaries deben emitirse ordenados, con comillas y separados por coma");
    }

    // ================================================================
    // Sanity: retirada del campo compartido keywords + refuerzos ADR-045
    // ================================================================

    @Test
    void sanity_legacyKeywordsSharedIsNotEmitted() {
        ContentAIProvider.PromptContext ctx = basicContextWithLegacyKeywords(
                "[\"legacy-1\", \"legacy-2\"]");
        String prompt = builder.build(ContentConstants.RUN_TYPE_FULL_ARTICLE_ORCHESTRATED, ctx);

        // ADR-045 D5: el prompt DEJA DE emitir la linea de keywords compartido.
        // Emisor legacy: `keywords: <valor>` como parte de "Datos compartidos".
        assertFalse(prompt.contains("Datos compartidos del articulo (todos los locales heredan de aqui)"),
                "El header legacy debe haber sido reemplazado");
        // La cadena "keywords:" (con espacios) puede aparecer en documentacion del
        // pipeline y en el schema (shared.keywords en el output_contract). Aqui
        // verificamos que el valor legacy no aparece literalmente en el prompt.
        assertFalse(prompt.contains("[\"legacy-1\", \"legacy-2\"]"),
                "El valor JSON de content_articles.keywords legacy NO debe emitirse");
    }

    @Test
    void sanity_outputContractContainsMergeD4Rules() {
        String prompt = builder.build(ContentConstants.RUN_TYPE_FULL_ARTICLE_ORCHESTRATED,
                basicContextWithLegacyKeywords(null));

        assertTrue(prompt.contains("Merge de target_keywords (ADR-045 D4)"),
                "output_contract debe declarar el header de merge D4");
        assertTrue(prompt.contains("NO se admite sustitucion por otro termino"),
                "output_contract debe prohibir sustitucion de primary");
        assertTrue(prompt.contains("Coherencia primary keyword (ADR-045 D4/D8)"),
                "regla dura de rechazo de coherencia primary debe estar presente");
    }

    @Test
    void sanity_selfCheckContainsPrimaryCoherenceChecks() {
        String prompt = builder.build(ContentConstants.RUN_TYPE_FULL_ARTICLE_ORCHESTRATED,
                basicContextWithLegacyKeywords(null));

        assertTrue(prompt.contains("coherencia keywords (ADR-045 D4/D8)"),
                "self_check debe incluir seccion de coherencia keywords");
        assertTrue(prompt.contains("EXACTAMENTE 1 objeto con type='primary'"),
                "self_check debe exigir 1 primary por locale");
        assertTrue(prompt.contains("si <locale_input>[es].primary_keyword no es vacio"),
                "self_check debe referenciar el input operador ES");
        assertTrue(prompt.contains("idem para <locale_input>[en].primary_keyword"),
                "self_check debe referenciar el input operador EN");
    }

    @Test
    void sanity_editorialInputContainsBothLocaleBlocks() {
        String prompt = builder.build(ContentConstants.RUN_TYPE_FULL_ARTICLE_ORCHESTRATED,
                basicContextWithLegacyKeywords(null));

        assertTrue(prompt.contains("<locale_input locale=\"es\">"));
        assertTrue(prompt.contains("</locale_input>"));
        assertTrue(prompt.contains("<locale_input locale=\"en\">"));
        // Reglas duras del editorial_input (input operador autoritativo)
        assertTrue(prompt.contains("Reglas duras (el input operador es autoritativo)"));
        assertTrue(prompt.contains("primary_keyword no vacio del input es AUTORITATIVO"));
    }

    // ================================================================
    // Helpers
    // ================================================================

    private ContentAIProvider.PromptContext basicContextWithLegacyKeywords(String keywordsJson) {
        return new ContentAIProvider.PromptContext(
                ContentConstants.RUN_TYPE_FULL_ARTICLE_ORCHESTRATED,
                42L,
                "some-slug",
                "Some title",
                "brief",
                "safety",
                keywordsJson,
                "https://cdn/hero.png",
                ContentConstants.STATE_DRAFT,
                null,
                7L,
                new ContentAIProvider.LocaleKeywords("foo", List.of("bar")),
                ContentAIProvider.LocaleKeywords.empty()
        );
    }
}
