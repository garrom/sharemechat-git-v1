package com.sharemechat.content.constants;

public final class ContentConstants {

    private ContentConstants() {}

    // Estados de articulo (ADR-016: workflow simplificado a 4 estados).
    // SCHEDULED se conserva en CHECK BD pero es inalcanzable via service
    // (decision D5 del ADR-016, diferida sin fecha).
    public static final String STATE_DRAFT = "DRAFT";
    public static final String STATE_IN_REVIEW = "IN_REVIEW";
    public static final String STATE_SCHEDULED = "SCHEDULED";
    public static final String STATE_PUBLISHED = "PUBLISHED";
    public static final String STATE_RETRACTED = "RETRACTED";

    // Tipos de evento de revision (ADR-016: OUTLINE_APPROVED, REVIEW_APPROVED
    // y REVIEW_REJECTED suprimidos junto con los estados intermedios).
    public static final String EVENT_DRAFT_REQUESTED = "DRAFT_REQUESTED";
    public static final String EVENT_EDIT_APPLIED = "EDIT_APPLIED";
    public static final String EVENT_PUBLISHED = "PUBLISHED";
    public static final String EVENT_RETRACTED = "RETRACTED";
    public static final String EVENT_SCHEDULED = "SCHEDULED";
    public static final String EVENT_DISCLOSURE_OVERRIDE = "DISCLOSURE_OVERRIDE";

    // Modos de generacion IA
    public static final String MODE_MANUAL_STRUCTURED = "MANUAL_STRUCTURED";
    public static final String MODE_API_HYBRID = "API_HYBRID";
    public static final String MODE_API_AUTO = "API_AUTO";

    // Locales soportados v1
    public static final String LOCALE_ES = "es";
    public static final String LOCALE_EN = "en";

    // S3 key layout (debajo de privateKeyPrefix). Post-ADR-025 el path es por locale.
    // Args: %d=articleId, %s=locale (es|en|...), %d=versionNumber (solo en VERSION_TEMPLATE).
    public static final String S3_KEY_DRAFT_TEMPLATE = "articles/%d/%s/draft.md";
    public static final String S3_KEY_VERSION_TEMPLATE = "articles/%d/%s/v%d.md";

    // Fase 3A — IA runs (Claude Cowork manual structured)
    public static final String RUN_TYPE_RESEARCH = "RESEARCH";
    public static final String RUN_TYPE_OUTLINE = "OUTLINE";
    public static final String RUN_TYPE_DRAFT = "DRAFT";
    public static final String RUN_TYPE_REVIEW = "REVIEW";
    public static final String RUN_TYPE_SEO = "SEO";
    // Fase 3B/ADR-014 — pipeline editorial orquestado por skills personales de Claude Cowork.
    // Reemplaza al antiguo RUN_TYPE_FULL_ARTICLE (ADR-013) que ejecutaba el pipeline en un
    // unico prompt monolitico.
    public static final String RUN_TYPE_FULL_ARTICLE_ORCHESTRATED = "FULL_ARTICLE_ORCHESTRATED";

    public static final String RUN_STATUS_PENDING = "PENDING";
    public static final String RUN_STATUS_VALIDATED = "VALIDATED";
    public static final String RUN_STATUS_REJECTED = "REJECTED";
    public static final String RUN_STATUS_FAILED = "FAILED";

    public static final String AI_PROVIDER_CLAUDE = "claude";
    // Schema 2.0 (ADR-025): JSON unico bilingue con seccion shared + locales{es,en}.
    public static final String AI_OUTPUT_SCHEMA_VERSION = "2.0";

    // Layout S3 para runs IA bajo privateKeyPrefix
    public static final String S3_KEY_RUN_PROMPT_TEMPLATE = "runs/%d/prompt.txt";
    public static final String S3_KEY_RUN_OUTPUT_RAW_TEMPLATE = "runs/%d/output_raw.md";
    public static final String S3_KEY_RUN_OUTPUT_VALIDATED_TEMPLATE = "runs/%d/output_validated.json";
    public static final String S3_KEY_RUN_VALIDATION_ERRORS_TEMPLATE = "runs/%d/validation_errors.json";

    // Convencion de prompt_template_id: "<RUN_TYPE>/v<N>"
    public static final String PROMPT_TEMPLATE_VERSION = "v1";

    // Logging
    public static final String LOG_PREFIX = "[CONTENT]";
}
