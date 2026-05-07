package com.sharemechat.content.service;

import com.fasterxml.jackson.core.JsonParseException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sharemechat.content.constants.ContentConstants;
import com.sharemechat.content.dto.ValidationErrorDTO;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Adaptador unico de Fase 3A. No invoca API externa: construye el prompt para
 * que el editor lo despache manualmente en Claude Cowork y valida el JSON
 * pegado de vuelta.
 */
@Component
public class ManualClipboardClaudeAdapter implements ContentAIProvider {

    private static final Set<String> ALLOWED_RUN_TYPES = Set.of(
            ContentConstants.RUN_TYPE_RESEARCH,
            ContentConstants.RUN_TYPE_OUTLINE,
            ContentConstants.RUN_TYPE_DRAFT,
            ContentConstants.RUN_TYPE_REVIEW,
            ContentConstants.RUN_TYPE_SEO,
            ContentConstants.RUN_TYPE_FULL_ARTICLE_ORCHESTRATED);

    // Minimos reforzados para FULL_ARTICLE_ORCHESTRATED (ADR-014).
    // Mismas cotas que el antiguo FULL_ARTICLE (ADR-013); el flujo orquestado
    // mantiene los umbrales editoriales aunque cambie como se generan.
    private static final int FULL_ARTICLE_ORCHESTRATED_MIN_SOURCES = 5;
    private static final int FULL_ARTICLE_ORCHESTRATED_MIN_OUTLINE_SECTIONS = 4;
    private static final int FULL_ARTICLE_ORCHESTRATED_MIN_DRAFT_CHARS = 800;

    // Heuristicas de estructura Markdown FULL_ARTICLE_ORCHESTRATED (heredadas de Fase 4A hardening)
    private static final Pattern MARKDOWN_H2_PATTERN =
            Pattern.compile("(?m)^## ");
    private static final Pattern MARKDOWN_PARAGRAPH_BREAK_PATTERN =
            Pattern.compile("\\n\\s*\\n");
    private static final Pattern MARKDOWN_HTML_INLINE_PATTERN =
            Pattern.compile(
                    "</?\\s*(p|br|strong|em|ul|ol|li|h[1-6]|a|div|span|table|tr|td)\\b",
                    Pattern.CASE_INSENSITIVE);

    /** Whitelist de model_id que el editor puede declarar al pegar output. */
    private static final Set<String> ALLOWED_MODEL_PREFIXES = Set.of(
            "claude-opus-",
            "claude-sonnet-",
            "claude-haiku-");

    private static final Set<String> ALLOWED_SEARCH_INTENTS = Set.of(
            "informational", "transactional", "navigational", "commercial");

    private static final List<String> REQUIRED_OUTPUT_FIELDS = List.of(
            "schema_version",
            "run_type",
            "language",
            "research_summary",
            "sources_used",
            "search_intent",
            "target_keywords",
            "competitor_insights",
            "article_outline",
            "draft_markdown",
            "seo_title",
            "meta_description",
            "suggested_slug",
            "risk_notes",
            "fact_check_notes",
            "self_check_passed",
            "self_check_failures");

    private final ObjectMapper objectMapper;
    private final ContentPromptBuilder promptBuilder;

    public ManualClipboardClaudeAdapter(ObjectMapper objectMapper,
                                        ContentPromptBuilder promptBuilder) {
        this.objectMapper = objectMapper;
        this.promptBuilder = promptBuilder;
    }

    @Override
    public String providerName() {
        return ContentConstants.AI_PROVIDER_CLAUDE;
    }

    @Override
    public String mode() {
        return ContentConstants.MODE_MANUAL_STRUCTURED;
    }

    @Override
    public String buildPrompt(PromptContext context) {
        if (context == null || context.runType() == null) {
            throw new IllegalArgumentException("PromptContext o runType nulo");
        }
        String runType = context.runType().toUpperCase(Locale.ROOT);
        if (!ALLOWED_RUN_TYPES.contains(runType)) {
            throw new IllegalArgumentException("run_type no soportado: " + runType);
        }
        return promptBuilder.build(runType, context);
    }

    @Override
    public boolean isModelAllowed(String modelId) {
        if (modelId == null || modelId.isBlank()) return false;
        String norm = modelId.trim().toLowerCase(Locale.ROOT);
        for (String prefix : ALLOWED_MODEL_PREFIXES) {
            if (norm.startsWith(prefix)) return true;
        }
        return false;
    }

    @Override
    public String resolveTemplateId(String runType) {
        return runType + "/" + ContentConstants.PROMPT_TEMPLATE_VERSION;
    }

    @Override
    public OutputValidationResult validateOutput(String runType, String rawOutput) {
        List<ValidationErrorDTO> errors = new ArrayList<>();

        if (rawOutput == null || rawOutput.isBlank()) {
            errors.add(new ValidationErrorDTO("body", "output vacio"));
            return new OutputValidationResult(false, errors, null);
        }
        String trimmed = rawOutput.trim();
        if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
            errors.add(new ValidationErrorDTO("body",
                    "el output debe ser exclusivamente un objeto JSON; texto fuera del JSON detectado"));
            return new OutputValidationResult(false, errors, null);
        }

        JsonNode root;
        try {
            root = objectMapper.readTree(trimmed);
        } catch (JsonParseException ex) {
            errors.add(new ValidationErrorDTO("body", "JSON no parseable: " + ex.getOriginalMessage()));
            return new OutputValidationResult(false, errors, null);
        } catch (JsonProcessingException ex) {
            errors.add(new ValidationErrorDTO("body", "JSON no parseable: " + ex.getMessage()));
            return new OutputValidationResult(false, errors, null);
        }
        if (root == null || !root.isObject()) {
            errors.add(new ValidationErrorDTO("body", "se esperaba un objeto JSON raiz"));
            return new OutputValidationResult(false, errors, null);
        }

        // Campos obligatorios presentes (aunque sean null o vacios)
        for (String field : REQUIRED_OUTPUT_FIELDS) {
            if (!root.has(field)) {
                errors.add(new ValidationErrorDTO(field, "campo obligatorio ausente"));
            }
        }

        // schema_version
        JsonNode schemaVersion = root.get("schema_version");
        if (schemaVersion != null && (!schemaVersion.isTextual()
                || !ContentConstants.AI_OUTPUT_SCHEMA_VERSION.equals(schemaVersion.asText()))) {
            errors.add(new ValidationErrorDTO("schema_version",
                    "se esperaba '" + ContentConstants.AI_OUTPUT_SCHEMA_VERSION + "'"));
        }

        // run_type coincide
        JsonNode runTypeNode = root.get("run_type");
        if (runTypeNode != null) {
            if (!runTypeNode.isTextual() || !runType.equals(runTypeNode.asText())) {
                errors.add(new ValidationErrorDTO("run_type",
                        "no coincide con el run creado (esperado " + runType + ")"));
            }
        }

        // search_intent enum
        JsonNode searchIntent = root.get("search_intent");
        if (searchIntent != null && !searchIntent.isNull()) {
            if (!searchIntent.isTextual() || !ALLOWED_SEARCH_INTENTS.contains(searchIntent.asText())) {
                errors.add(new ValidationErrorDTO("search_intent",
                        "valor no permitido; usa informational/transactional/navigational/commercial"));
            }
        }

        // sources_used: array; obligatorio no vacio para RESEARCH y DRAFT
        JsonNode sourcesUsed = root.get("sources_used");
        boolean sourcesRequired = ContentConstants.RUN_TYPE_RESEARCH.equals(runType)
                || ContentConstants.RUN_TYPE_DRAFT.equals(runType);
        if (sourcesUsed != null) {
            if (!sourcesUsed.isArray()) {
                errors.add(new ValidationErrorDTO("sources_used", "debe ser array"));
            } else {
                if (sourcesRequired && sourcesUsed.isEmpty()) {
                    errors.add(new ValidationErrorDTO("sources_used",
                            "obligatorio no vacio para run_type=" + runType));
                }
                for (int i = 0; i < sourcesUsed.size(); i++) {
                    JsonNode src = sourcesUsed.get(i);
                    if (!src.isObject()) {
                        errors.add(new ValidationErrorDTO("sources_used[" + i + "]",
                                "se esperaba objeto"));
                        continue;
                    }
                    JsonNode urlNode = src.get("url");
                    if (urlNode == null || !urlNode.isTextual() || urlNode.asText().isBlank()) {
                        errors.add(new ValidationErrorDTO("sources_used[" + i + "].url",
                                "url ausente o vacia"));
                        continue;
                    }
                    String url = urlNode.asText();
                    try {
                        URI u = new URI(url);
                        String scheme = u.getScheme();
                        if (scheme == null
                                || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))) {
                            errors.add(new ValidationErrorDTO("sources_used[" + i + "].url",
                                    "scheme debe ser http o https"));
                        }
                        if (u.getHost() == null || u.getHost().isBlank()) {
                            errors.add(new ValidationErrorDTO("sources_used[" + i + "].url",
                                    "host ausente"));
                        }
                    } catch (URISyntaxException ex) {
                        errors.add(new ValidationErrorDTO("sources_used[" + i + "].url",
                                "url no parseable"));
                    }
                }
            }
        }

        // draft_markdown obligatorio para DRAFT
        JsonNode draftMarkdown = root.get("draft_markdown");
        if (ContentConstants.RUN_TYPE_DRAFT.equals(runType)) {
            if (draftMarkdown == null || draftMarkdown.isNull()
                    || !draftMarkdown.isTextual() || draftMarkdown.asText().isBlank()) {
                errors.add(new ValidationErrorDTO("draft_markdown",
                        "obligatorio no vacio para run_type=DRAFT"));
            }
        }

        // seo_title <= 60
        JsonNode seoTitle = root.get("seo_title");
        if (seoTitle != null && seoTitle.isTextual() && seoTitle.asText().length() > 60) {
            errors.add(new ValidationErrorDTO("seo_title",
                    "excede 60 caracteres (" + seoTitle.asText().length() + ")"));
        }

        // meta_description <= 160
        JsonNode metaDescription = root.get("meta_description");
        if (metaDescription != null && metaDescription.isTextual()
                && metaDescription.asText().length() > 160) {
            errors.add(new ValidationErrorDTO("meta_description",
                    "excede 160 caracteres (" + metaDescription.asText().length() + ")"));
        }

        // self_check_failures debe ser array si presente
        JsonNode selfCheckFailures = root.get("self_check_failures");
        if (selfCheckFailures != null && !selfCheckFailures.isNull()
                && !selfCheckFailures.isArray()) {
            errors.add(new ValidationErrorDTO("self_check_failures", "debe ser array"));
        }

        // article_outline debe ser array si presente
        JsonNode outline = root.get("article_outline");
        if (outline != null && !outline.isNull() && !outline.isArray()) {
            errors.add(new ValidationErrorDTO("article_outline", "debe ser array"));
        }

        // target_keywords debe ser array si presente
        JsonNode targetKeywords = root.get("target_keywords");
        if (targetKeywords != null && !targetKeywords.isNull() && !targetKeywords.isArray()) {
            errors.add(new ValidationErrorDTO("target_keywords", "debe ser array"));
        }

        // competitor_insights debe ser array si presente
        JsonNode competitor = root.get("competitor_insights");
        if (competitor != null && !competitor.isNull() && !competitor.isArray()) {
            errors.add(new ValidationErrorDTO("competitor_insights", "debe ser array"));
        }

        // risk_notes / fact_check_notes deben ser arrays si presentes
        for (String f : Arrays.asList("risk_notes", "fact_check_notes")) {
            JsonNode n = root.get(f);
            if (n != null && !n.isNull() && !n.isArray()) {
                errors.add(new ValidationErrorDTO(f, "debe ser array"));
            }
        }

        // Validacion reforzada para FULL_ARTICLE_ORCHESTRATED (ADR-014)
        if (ContentConstants.RUN_TYPE_FULL_ARTICLE_ORCHESTRATED.equals(runType)) {
            validateFullArticleOrchestratedSpecifics(root, errors);
        }

        if (!errors.isEmpty()) {
            return new OutputValidationResult(false, errors, null);
        }

        // Re-serializar canonico (orden estable y sin comentarios extra)
        try {
            // Reordenar campos clave al frente para consistencia de auditoria
            String canonical = objectMapper.writeValueAsString(root);
            return new OutputValidationResult(true, List.of(), canonical);
        } catch (JsonProcessingException ex) {
            errors.add(new ValidationErrorDTO("body",
                    "no se pudo re-serializar canonico: " + ex.getMessage()));
            return new OutputValidationResult(false, errors, null);
        }
    }

    /** Para uso interno y tests; expone iterador de campos requeridos. */
    public Iterator<String> requiredFields() {
        return REQUIRED_OUTPUT_FIELDS.iterator();
    }

    /**
     * Validacion reforzada para FULL_ARTICLE_ORCHESTRATED (ADR-014):
     *  - sources_used >= 5
     *  - article_outline >= 4 secciones
     *  - draft_markdown no nulo y >= 800 chars
     *  - seo_title no nulo, no vacio, <= 60 chars
     *  - meta_description no nulo, no vacio, <= 160 chars
     *  - target_keywords con al menos un type=primary
     *  - self_check_passed = true obligatorio
     * Acumula errores en la lista existente; no rechaza inmediatamente.
     */
    private void validateFullArticleOrchestratedSpecifics(JsonNode root, List<ValidationErrorDTO> errors) {
        JsonNode sourcesUsed = root.get("sources_used");
        if (sourcesUsed != null && sourcesUsed.isArray()
                && sourcesUsed.size() < FULL_ARTICLE_ORCHESTRATED_MIN_SOURCES) {
            errors.add(new ValidationErrorDTO("sources_used",
                    "FULL_ARTICLE_ORCHESTRATED exige al menos " + FULL_ARTICLE_ORCHESTRATED_MIN_SOURCES
                            + " fuentes (recibidas " + sourcesUsed.size() + ")"));
        }

        JsonNode outline = root.get("article_outline");
        if (outline != null && outline.isArray()
                && outline.size() < FULL_ARTICLE_ORCHESTRATED_MIN_OUTLINE_SECTIONS) {
            errors.add(new ValidationErrorDTO("article_outline",
                    "FULL_ARTICLE_ORCHESTRATED exige al menos " + FULL_ARTICLE_ORCHESTRATED_MIN_OUTLINE_SECTIONS
                            + " secciones (recibidas " + outline.size() + ")"));
        }

        JsonNode draftMarkdown = root.get("draft_markdown");
        if (draftMarkdown == null || draftMarkdown.isNull() || !draftMarkdown.isTextual()
                || draftMarkdown.asText().length() < FULL_ARTICLE_ORCHESTRATED_MIN_DRAFT_CHARS) {
            int len = (draftMarkdown == null || draftMarkdown.isNull() || !draftMarkdown.isTextual())
                    ? 0 : draftMarkdown.asText().length();
            errors.add(new ValidationErrorDTO("draft_markdown",
                    "FULL_ARTICLE_ORCHESTRATED exige draft_markdown >= " + FULL_ARTICLE_ORCHESTRATED_MIN_DRAFT_CHARS
                            + " caracteres (recibidos " + len + ")"));
        }

        JsonNode seoTitle = root.get("seo_title");
        if (seoTitle == null || seoTitle.isNull() || !seoTitle.isTextual()
                || seoTitle.asText().isBlank()) {
            errors.add(new ValidationErrorDTO("seo_title",
                    "FULL_ARTICLE_ORCHESTRATED exige seo_title no vacio"));
        }

        JsonNode metaDescription = root.get("meta_description");
        if (metaDescription == null || metaDescription.isNull()
                || !metaDescription.isTextual() || metaDescription.asText().isBlank()) {
            errors.add(new ValidationErrorDTO("meta_description",
                    "FULL_ARTICLE_ORCHESTRATED exige meta_description no vacia"));
        }

        JsonNode targetKeywords = root.get("target_keywords");
        if (targetKeywords != null && targetKeywords.isArray()) {
            boolean hasPrimary = false;
            for (JsonNode kw : targetKeywords) {
                if (kw != null && kw.isObject()) {
                    JsonNode type = kw.get("type");
                    if (type != null && type.isTextual() && "primary".equals(type.asText())) {
                        hasPrimary = true;
                        break;
                    }
                }
            }
            if (!hasPrimary) {
                errors.add(new ValidationErrorDTO("target_keywords",
                        "FULL_ARTICLE_ORCHESTRATED exige al menos un keyword con type=primary"));
            }
        }

        JsonNode selfCheckPassed = root.get("self_check_passed");
        if (selfCheckPassed == null || !selfCheckPassed.isBoolean()
                || !selfCheckPassed.asBoolean()) {
            errors.add(new ValidationErrorDTO("self_check_passed",
                    "FULL_ARTICLE_ORCHESTRATED exige self_check_passed=true (run atomico)"));
        }

        // Heuristicas de estructura Markdown (heredadas del hardening Fase 4A).
        // Solo se evaluan si draft_markdown existe y tiene la longitud minima; los checks
        // de existencia/longitud ya han disparado un error si no es el caso.
        if (draftMarkdown != null && !draftMarkdown.isNull() && draftMarkdown.isTextual()
                && draftMarkdown.asText().length() >= FULL_ARTICLE_ORCHESTRATED_MIN_DRAFT_CHARS) {
            String md = draftMarkdown.asText();

            // Check 1: al menos un H2 literal "^## " al inicio de linea
            if (!MARKDOWN_H2_PATTERN.matcher(md).find()) {
                errors.add(new ValidationErrorDTO("draft_markdown",
                        "FULL_ARTICLE_ORCHESTRATED exige al menos un heading H2 literal con sintaxis Markdown"
                                + " (\"## \" al inicio de linea); el draft parece texto plano"));
            }

            // Check 2: separacion de parrafos con linea en blanco
            if (!MARKDOWN_PARAGRAPH_BREAK_PATTERN.matcher(md).find()) {
                errors.add(new ValidationErrorDTO("draft_markdown",
                        "FULL_ARTICLE_ORCHESTRATED exige separacion de parrafos con linea en blanco"
                                + " (doble salto de linea); el draft no la contiene"));
            }

            // Check 3: prohibir HTML inline obvio
            if (MARKDOWN_HTML_INLINE_PATTERN.matcher(md).find()) {
                errors.add(new ValidationErrorDTO("draft_markdown",
                        "FULL_ARTICLE_ORCHESTRATED prohibe HTML inline en draft_markdown; usa Markdown puro"));
            }
        }
    }
}
