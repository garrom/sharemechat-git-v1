package com.sharemechat.content.service;

import com.fasterxml.jackson.core.JsonLocation;
import com.fasterxml.jackson.core.JsonParseException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sharemechat.content.constants.ContentConstants;
import com.sharemechat.content.dto.ValidationErrorDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Adaptador unico de la capa IA del CMS. No invoca API externa: construye
 * el prompt para que el operador lo despache manualmente en Claude Cowork
 * y valida el JSON pegado de vuelta.
 *
 * Post-ADR-025: schema 2.0 bilingue. El JSON tiene estructura
 *   {
 *     schema_version, run_type,
 *     shared: { category, keywords?, sources_used, self_check_passed, ... },
 *     locales: { es: {...}, en: {...} }
 *   }
 *
 * Solo el run_type FULL_ARTICLE_ORCHESTRATED es operativo en paquete 2.
 * Los run_type discretos (RESEARCH/OUTLINE/DRAFT/REVIEW/SEO) salen de la
 * whitelist; un cliente API que intente crearlos recibira 400.
 */
@Component
public class ManualClipboardClaudeAdapter implements ContentAIProvider {

    private static final Logger log = LoggerFactory.getLogger(ManualClipboardClaudeAdapter.class);

    /** Solo FULL_ARTICLE_ORCHESTRATED es operativo en el modelo bilingue. */
    private static final Set<String> ALLOWED_RUN_TYPES = Set.of(
            ContentConstants.RUN_TYPE_FULL_ARTICLE_ORCHESTRATED);

    // Minimos reforzados por locale (heredados de schema 1.0; el modelo bilingue
    // los aplica per-locale, no globales como antes).
    private static final int MIN_SOURCES = 5;
    private static final int MIN_OUTLINE_SECTIONS = 4;
    private static final int MIN_DRAFT_CHARS = 800;

    // Heuristicas de estructura Markdown.
    private static final Pattern MARKDOWN_H2_PATTERN =
            Pattern.compile("(?m)^## ");
    private static final Pattern MARKDOWN_PARAGRAPH_BREAK_PATTERN =
            Pattern.compile("\\n\\s*\\n");
    private static final Pattern MARKDOWN_HTML_INLINE_PATTERN =
            Pattern.compile(
                    "</?\\s*(p|br|strong|em|ul|ol|li|h[1-6]|a|div|span|table|tr|td)\\b",
                    Pattern.CASE_INSENSITIVE);

    private static final Pattern SLUG_PATTERN =
            Pattern.compile("^[a-z0-9]+(?:-[a-z0-9]+)*$");
    private static final int SLUG_MAX = 160;
    private static final int TITLE_MAX = 255;
    private static final int SEO_TITLE_MAX = 60;
    private static final int META_DESCRIPTION_MAX = 160;

    /** Whitelist de model_id que el editor puede declarar al pegar output. */
    private static final Set<String> ALLOWED_MODEL_PREFIXES = Set.of(
            "claude-opus-",
            "claude-sonnet-",
            "claude-haiku-");

    private static final Set<String> ALLOWED_SEARCH_INTENTS = Set.of(
            "informational", "transactional", "navigational", "commercial");

    /** Locales obligatorios para publicar (ADR-025). */
    private static final Set<String> MANDATORY_LOCALES = Set.of(
            ContentConstants.LOCALE_ES, ContentConstants.LOCALE_EN);

    /** Campos obligatorios bajo `shared`. */
    private static final List<String> SHARED_REQUIRED_FIELDS = List.of(
            "category",
            "sources_used",
            "self_check_passed");

    /** Campos obligatorios bajo cada `locales.<lang>`. */
    private static final List<String> LOCALE_REQUIRED_FIELDS = List.of(
            "slug",
            "title",
            "seo_title",
            "meta_description",
            "draft_markdown",
            "search_intent",
            "target_keywords",
            "competitor_insights",
            "article_outline");

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
            // Paquete 6.7: mensaje de error util. Extraemos linea+columna del
            // JsonLocation y un fragmento de ~40 chars alrededor del char
            // offset para que el operador sepa exactamente donde corregir.
            // El uso mas tipico que provoca este fallo: comilla doble ASCII
            // U+0022 no escapada dentro de un campo string (p. ej. enfasis
            // estilistico en draft_markdown). El mensaje guia hacia ese caso.
            errors.add(formatJsonParseError(ex, trimmed));
            return new OutputValidationResult(false, errors, null);
        } catch (JsonProcessingException ex) {
            errors.add(formatJsonProcessingError(ex));
            return new OutputValidationResult(false, errors, null);
        }
        if (root == null || !root.isObject()) {
            errors.add(new ValidationErrorDTO("body", "se esperaba un objeto JSON raiz"));
            return new OutputValidationResult(false, errors, null);
        }

        validateTopLevel(root, runType, errors);
        validateSharedSection(root, errors);
        validateLocalesSection(root, errors);

        if (!errors.isEmpty()) {
            return new OutputValidationResult(false, errors, null);
        }

        try {
            String canonical = objectMapper.writeValueAsString(root);
            return new OutputValidationResult(true, List.of(), canonical);
        } catch (JsonProcessingException ex) {
            errors.add(new ValidationErrorDTO("body",
                    "no se pudo re-serializar canonico: " + ex.getMessage()));
            return new OutputValidationResult(false, errors, null);
        }
    }

    /** Para uso interno y tests: lista campos obligatorios por seccion. */
    public Iterator<String> requiredSharedFields() {
        return SHARED_REQUIRED_FIELDS.iterator();
    }

    public Iterator<String> requiredLocaleFields() {
        return LOCALE_REQUIRED_FIELDS.iterator();
    }

    // ================================================================
    // Validaciones por seccion
    // ================================================================

    private void validateTopLevel(JsonNode root, String runType, List<ValidationErrorDTO> errors) {
        JsonNode schemaVersion = root.get("schema_version");
        if (schemaVersion == null || !schemaVersion.isTextual()
                || !ContentConstants.AI_OUTPUT_SCHEMA_VERSION.equals(schemaVersion.asText())) {
            errors.add(new ValidationErrorDTO("schema_version",
                    "se esperaba '" + ContentConstants.AI_OUTPUT_SCHEMA_VERSION + "'"));
        }

        JsonNode runTypeNode = root.get("run_type");
        if (runTypeNode == null || !runTypeNode.isTextual() || !runType.equals(runTypeNode.asText())) {
            errors.add(new ValidationErrorDTO("run_type",
                    "no coincide con el run creado (esperado " + runType + ")"));
        }

        if (!root.has("shared") || !root.get("shared").isObject()) {
            errors.add(new ValidationErrorDTO("shared", "seccion 'shared' ausente o no es objeto"));
        }
        if (!root.has("locales") || !root.get("locales").isObject()) {
            errors.add(new ValidationErrorDTO("locales", "seccion 'locales' ausente o no es objeto"));
        }
    }

    private void validateSharedSection(JsonNode root, List<ValidationErrorDTO> errors) {
        JsonNode shared = root.get("shared");
        if (shared == null || !shared.isObject()) return; // ya marcado arriba

        for (String field : SHARED_REQUIRED_FIELDS) {
            if (!shared.has(field)) {
                errors.add(new ValidationErrorDTO("shared." + field, "campo obligatorio ausente"));
            }
        }

        // shared.category no vacia
        JsonNode category = shared.get("category");
        if (category != null && (!category.isTextual() || category.asText().isBlank())) {
            errors.add(new ValidationErrorDTO("shared.category", "no puede estar vacia"));
        }

        // shared.sources_used array >= 5 con url http(s) valida cada uno
        JsonNode sources = shared.get("sources_used");
        if (sources != null) {
            if (!sources.isArray()) {
                errors.add(new ValidationErrorDTO("shared.sources_used", "debe ser array"));
            } else {
                if (sources.size() < MIN_SOURCES) {
                    errors.add(new ValidationErrorDTO("shared.sources_used",
                            "se requieren al menos " + MIN_SOURCES + " fuentes (recibidas "
                                    + sources.size() + ")"));
                }
                for (int i = 0; i < sources.size(); i++) {
                    validateSourceEntry(sources.get(i), i, errors);
                }
            }
        }

        // shared.self_check_passed === true
        JsonNode selfCheck = shared.get("self_check_passed");
        if (selfCheck != null && (!selfCheck.isBoolean() || !selfCheck.asBoolean())) {
            errors.add(new ValidationErrorDTO("shared.self_check_passed",
                    "debe ser true (run atomico, no admite parcial)"));
        }

        // self_check_failures opcional pero si presente debe ser array
        JsonNode failures = shared.get("self_check_failures");
        if (failures != null && !failures.isNull() && !failures.isArray()) {
            errors.add(new ValidationErrorDTO("shared.self_check_failures", "debe ser array"));
        }
    }

    private void validateSourceEntry(JsonNode src, int index, List<ValidationErrorDTO> errors) {
        String path = "shared.sources_used[" + index + "]";
        if (!src.isObject()) {
            errors.add(new ValidationErrorDTO(path, "se esperaba objeto"));
            return;
        }
        JsonNode urlNode = src.get("url");
        if (urlNode == null || !urlNode.isTextual() || urlNode.asText().isBlank()) {
            errors.add(new ValidationErrorDTO(path + ".url", "url ausente o vacia"));
            return;
        }
        String url = urlNode.asText();
        try {
            URI u = new URI(url);
            String scheme = u.getScheme();
            if (scheme == null
                    || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))) {
                errors.add(new ValidationErrorDTO(path + ".url", "scheme debe ser http o https"));
            }
            if (u.getHost() == null || u.getHost().isBlank()) {
                errors.add(new ValidationErrorDTO(path + ".url", "host ausente"));
            }
        } catch (URISyntaxException ex) {
            errors.add(new ValidationErrorDTO(path + ".url", "url no parseable"));
        }
    }

    private void validateLocalesSection(JsonNode root, List<ValidationErrorDTO> errors) {
        JsonNode locales = root.get("locales");
        if (locales == null || !locales.isObject()) return; // ya marcado arriba

        // Debe contener exactamente "es" y "en".
        for (String required : MANDATORY_LOCALES) {
            if (!locales.has(required) || !locales.get(required).isObject()) {
                errors.add(new ValidationErrorDTO("locales." + required,
                        "locale obligatorio ausente o no es objeto"));
            }
        }
        Iterator<String> fieldNames = locales.fieldNames();
        while (fieldNames.hasNext()) {
            String key = fieldNames.next();
            if (!MANDATORY_LOCALES.contains(key)) {
                errors.add(new ValidationErrorDTO("locales." + key,
                        "locale no soportado en paquete 2 (solo 'es' y 'en')"));
            }
        }

        // Por locale, validar campos.
        for (String localeKey : MANDATORY_LOCALES) {
            JsonNode loc = locales.get(localeKey);
            if (loc == null || !loc.isObject()) continue; // ya marcado
            validateLocaleEntry(localeKey, loc, errors);
        }

        // Cross-locale: slugs deben divergir entre ES y EN (ADR-022 D2).
        JsonNode es = locales.get(ContentConstants.LOCALE_ES);
        JsonNode en = locales.get(ContentConstants.LOCALE_EN);
        if (es != null && es.isObject() && en != null && en.isObject()) {
            String slugEs = textOrNull(es, "slug");
            String slugEn = textOrNull(en, "slug");
            if (slugEs != null && slugEs.equals(slugEn)) {
                errors.add(new ValidationErrorDTO("locales.en.slug",
                        "slug ES y EN deben divergir (ADR-022 D2): ambos son '" + slugEs + "'"));
            }

            // WARN no bloqueante: numero de H2 entre locales (paridad estructural).
            String draftEs = textOrNull(es, "draft_markdown");
            String draftEn = textOrNull(en, "draft_markdown");
            if (draftEs != null && draftEn != null) {
                int h2Es = countMatches(MARKDOWN_H2_PATTERN, draftEs);
                int h2En = countMatches(MARKDOWN_H2_PATTERN, draftEn);
                if (h2Es != h2En) {
                    log.warn("{} bilingual H2 mismatch: locales.es has {} H2, locales.en has {}; "
                                    + "no se bloquea pero conviene revisar paridad",
                            ContentConstants.LOG_PREFIX, h2Es, h2En);
                }
            }
        }
    }

    private void validateLocaleEntry(String localeKey, JsonNode loc, List<ValidationErrorDTO> errors) {
        String pathBase = "locales." + localeKey;

        for (String field : LOCALE_REQUIRED_FIELDS) {
            if (!loc.has(field)) {
                errors.add(new ValidationErrorDTO(pathBase + "." + field, "campo obligatorio ausente"));
            }
        }

        // slug kebab-case
        JsonNode slug = loc.get("slug");
        if (slug != null && !slug.isNull()) {
            if (!slug.isTextual() || slug.asText().isBlank()) {
                errors.add(new ValidationErrorDTO(pathBase + ".slug", "slug requerido"));
            } else {
                String s = slug.asText();
                if (s.length() > SLUG_MAX) {
                    errors.add(new ValidationErrorDTO(pathBase + ".slug",
                            "excede " + SLUG_MAX + " caracteres"));
                }
                if (!SLUG_PATTERN.matcher(s).matches()) {
                    errors.add(new ValidationErrorDTO(pathBase + ".slug",
                            "slug invalido: solo minusculas, digitos y guiones (kebab-case)"));
                }
            }
        }

        // title <= 255
        JsonNode title = loc.get("title");
        if (title != null && !title.isNull()) {
            if (!title.isTextual() || title.asText().isBlank()) {
                errors.add(new ValidationErrorDTO(pathBase + ".title", "title requerido"));
            } else if (title.asText().length() > TITLE_MAX) {
                errors.add(new ValidationErrorDTO(pathBase + ".title",
                        "excede " + TITLE_MAX + " caracteres"));
            }
        }

        // seo_title <= 60
        JsonNode seoTitle = loc.get("seo_title");
        if (seoTitle != null && !seoTitle.isNull()) {
            if (!seoTitle.isTextual() || seoTitle.asText().isBlank()) {
                errors.add(new ValidationErrorDTO(pathBase + ".seo_title", "seo_title requerido no vacio"));
            } else if (seoTitle.asText().length() > SEO_TITLE_MAX) {
                errors.add(new ValidationErrorDTO(pathBase + ".seo_title",
                        "excede " + SEO_TITLE_MAX + " caracteres (" + seoTitle.asText().length() + ")"));
            }
        }

        // meta_description <= 160
        JsonNode metaDesc = loc.get("meta_description");
        if (metaDesc != null && !metaDesc.isNull()) {
            if (!metaDesc.isTextual() || metaDesc.asText().isBlank()) {
                errors.add(new ValidationErrorDTO(pathBase + ".meta_description",
                        "meta_description requerida no vacia"));
            } else if (metaDesc.asText().length() > META_DESCRIPTION_MAX) {
                errors.add(new ValidationErrorDTO(pathBase + ".meta_description",
                        "excede " + META_DESCRIPTION_MAX + " caracteres ("
                                + metaDesc.asText().length() + ")"));
            }
        }

        // draft_markdown >= 800 + estructura Markdown literal
        JsonNode draft = loc.get("draft_markdown");
        if (draft != null && !draft.isNull()) {
            if (!draft.isTextual() || draft.asText().isBlank()) {
                errors.add(new ValidationErrorDTO(pathBase + ".draft_markdown",
                        "draft_markdown requerido no vacio"));
            } else {
                String md = draft.asText();
                if (md.length() < MIN_DRAFT_CHARS) {
                    errors.add(new ValidationErrorDTO(pathBase + ".draft_markdown",
                            "se requieren al menos " + MIN_DRAFT_CHARS
                                    + " caracteres (recibidos " + md.length() + ")"));
                }
                if (!MARKDOWN_H2_PATTERN.matcher(md).find()) {
                    errors.add(new ValidationErrorDTO(pathBase + ".draft_markdown",
                            "se requiere al menos un H2 literal con sintaxis Markdown"
                                    + " (\"## \" al inicio de linea)"));
                }
                if (!MARKDOWN_PARAGRAPH_BREAK_PATTERN.matcher(md).find()) {
                    errors.add(new ValidationErrorDTO(pathBase + ".draft_markdown",
                            "se requiere separacion de parrafos con linea en blanco"
                                    + " (doble salto de linea)"));
                }
                if (MARKDOWN_HTML_INLINE_PATTERN.matcher(md).find()) {
                    errors.add(new ValidationErrorDTO(pathBase + ".draft_markdown",
                            "prohibido HTML inline; usa Markdown puro"));
                }
            }
        }

        // search_intent enum
        JsonNode intent = loc.get("search_intent");
        if (intent != null && !intent.isNull()) {
            if (!intent.isTextual() || !ALLOWED_SEARCH_INTENTS.contains(intent.asText())) {
                errors.add(new ValidationErrorDTO(pathBase + ".search_intent",
                        "valor no permitido; usa informational/transactional/navigational/commercial"));
            }
        }

        // target_keywords array con al menos un type=primary
        JsonNode keywords = loc.get("target_keywords");
        if (keywords != null && !keywords.isNull()) {
            if (!keywords.isArray()) {
                errors.add(new ValidationErrorDTO(pathBase + ".target_keywords", "debe ser array"));
            } else {
                boolean hasPrimary = false;
                for (JsonNode kw : keywords) {
                    if (kw != null && kw.isObject()) {
                        JsonNode type = kw.get("type");
                        if (type != null && type.isTextual() && "primary".equals(type.asText())) {
                            hasPrimary = true;
                            break;
                        }
                    }
                }
                if (!hasPrimary) {
                    errors.add(new ValidationErrorDTO(pathBase + ".target_keywords",
                            "se requiere al menos un keyword con type=primary"));
                }
            }
        }

        // competitor_insights array si presente
        JsonNode competitor = loc.get("competitor_insights");
        if (competitor != null && !competitor.isNull() && !competitor.isArray()) {
            errors.add(new ValidationErrorDTO(pathBase + ".competitor_insights", "debe ser array"));
        }

        // article_outline array >= 4
        JsonNode outline = loc.get("article_outline");
        if (outline != null && !outline.isNull()) {
            if (!outline.isArray()) {
                errors.add(new ValidationErrorDTO(pathBase + ".article_outline", "debe ser array"));
            } else if (outline.size() < MIN_OUTLINE_SECTIONS) {
                errors.add(new ValidationErrorDTO(pathBase + ".article_outline",
                        "se requieren al menos " + MIN_OUTLINE_SECTIONS
                                + " secciones (recibidas " + outline.size() + ")"));
            }
        }

        // risk_notes / fact_check_notes son arrays si presentes (opcionales).
        for (String f : List.of("risk_notes", "fact_check_notes")) {
            JsonNode n = loc.get(f);
            if (n != null && !n.isNull() && !n.isArray()) {
                errors.add(new ValidationErrorDTO(pathBase + "." + f, "debe ser array"));
            }
        }
    }

    // ================================================================
    // Helpers de mensajes de error JSON (paquete 6.7)
    // ================================================================

    /** Constante de codigo de error para parseo JSON; expuesta como `code`
     * en {@link ValidationErrorDTO} desde paquete 7 (antes iba como prefijo
     * del message en 6.7). El frontend la lee como `error.validationErrors[0].code`. */
    private static final String CODE_JSON_PARSE_ERROR = "JSON_PARSE_ERROR";

    /**
     * Formatea el error de un {@link JsonParseException} con linea, columna
     * y fragmento de contexto cuando esten disponibles. Devuelve un
     * {@link ValidationErrorDTO} con:
     *  - field = "body"
     *  - code  = "JSON_PARSE_ERROR"
     *  - context = fragmento ~40 chars alrededor del char offset, con caret
     *  - message = descripcion legible para el operador, con guia operativa
     *
     * El caso de error mas tipico que vemos en el pipeline editorial es
     * una comilla doble ASCII (U+0022) no escapada dentro de un campo
     * string del JSON; por eso la sugerencia final menciona ese caso.
     */
    private static ValidationErrorDTO formatJsonParseError(JsonParseException ex, String rawJson) {
        StringBuilder msg = new StringBuilder();
        JsonLocation loc = ex.getLocation();
        boolean haveLocation = loc != null
                && (loc.getLineNr() > 0 || loc.getColumnNr() > 0);
        String context = null;
        if (haveLocation) {
            msg.append("JSON malformado en linea ")
                    .append(loc.getLineNr())
                    .append(" columna ")
                    .append(loc.getColumnNr())
                    .append(". ");
            context = extractContext(rawJson, loc.getCharOffset());
        } else {
            msg.append("JSON malformado. ");
        }
        String original = ex.getOriginalMessage();
        if (original != null && !original.isBlank()) {
            msg.append("Detalle Jackson: ").append(original.trim()).append(". ");
        }
        msg.append("Verifica comillas dobles dentro de strings: ")
                .append("escapalas con \\\" o sustituyelas por curvas tipograficas “…”.");
        return new ValidationErrorDTO("body", msg.toString(), CODE_JSON_PARSE_ERROR, context);
    }

    /** Variante para JsonProcessingException no especifica de parseo. */
    private static ValidationErrorDTO formatJsonProcessingError(JsonProcessingException ex) {
        StringBuilder msg = new StringBuilder();
        JsonLocation loc = ex.getLocation();
        if (loc != null && (loc.getLineNr() > 0 || loc.getColumnNr() > 0)) {
            msg.append("JSON malformado en linea ")
                    .append(loc.getLineNr())
                    .append(" columna ")
                    .append(loc.getColumnNr())
                    .append(". ");
        } else {
            msg.append("JSON malformado. ");
        }
        msg.append("Detalle Jackson: ").append(ex.getMessage());
        return new ValidationErrorDTO("body", msg.toString(), CODE_JSON_PARSE_ERROR, null);
    }

    /**
     * Extrae los ~40 chars alrededor del char offset del error, recortando
     * los limites del raw para no salirse del array. Reemplaza saltos de
     * linea por espacios y secuencias \r\n por espacio para que el mensaje
     * se renderice limpio en la UI. Devuelve null si el offset es invalido.
     */
    private static String extractContext(String rawJson, long charOffset) {
        if (rawJson == null || charOffset < 0) return null;
        int center = (int) Math.min(charOffset, (long) rawJson.length());
        int from = Math.max(0, center - 20);
        int to = Math.min(rawJson.length(), center + 20);
        if (from >= to) return null;
        String slice = rawJson.substring(from, to)
                .replace("\r", " ")
                .replace("\n", " ")
                .replace("\t", " ");
        // Marca posicional con un caret encima del offset original.
        int relativeCaret = center - from;
        if (relativeCaret >= 0 && relativeCaret <= slice.length()) {
            StringBuilder sb = new StringBuilder();
            sb.append(slice, 0, relativeCaret);
            sb.append("▸"); // triangulo blanco apuntando a la derecha
            sb.append(slice, relativeCaret, slice.length());
            return sb.toString();
        }
        return slice;
    }

    private static String textOrNull(JsonNode root, String field) {
        if (root == null) return null;
        JsonNode n = root.get(field);
        if (n == null || n.isNull() || !n.isTextual()) return null;
        String v = n.asText();
        return v.isBlank() ? null : v;
    }

    private static int countMatches(Pattern p, String text) {
        if (text == null) return 0;
        int count = 0;
        java.util.regex.Matcher m = p.matcher(text);
        while (m.find()) count++;
        return count;
    }
}
