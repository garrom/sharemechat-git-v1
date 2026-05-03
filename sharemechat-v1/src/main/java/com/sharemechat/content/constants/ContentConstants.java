package com.sharemechat.content.constants;

public final class ContentConstants {

    private ContentConstants() {}

    // Estados de articulo (ADR-010, seccion 5)
    public static final String STATE_IDEA = "IDEA";
    public static final String STATE_OUTLINE_READY = "OUTLINE_READY";
    public static final String STATE_DRAFT_GENERATED = "DRAFT_GENERATED";
    public static final String STATE_IN_REVIEW = "IN_REVIEW";
    public static final String STATE_APPROVED = "APPROVED";
    public static final String STATE_SCHEDULED = "SCHEDULED";
    public static final String STATE_PUBLISHED = "PUBLISHED";
    public static final String STATE_RETRACTED = "RETRACTED";

    // Tipos de evento de revision
    public static final String EVENT_OUTLINE_APPROVED = "OUTLINE_APPROVED";
    public static final String EVENT_DRAFT_REQUESTED = "DRAFT_REQUESTED";
    public static final String EVENT_EDIT_APPLIED = "EDIT_APPLIED";
    public static final String EVENT_REVIEW_APPROVED = "REVIEW_APPROVED";
    public static final String EVENT_REVIEW_REJECTED = "REVIEW_REJECTED";
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

    // S3 key layout (debajo de privateKeyPrefix)
    public static final String S3_KEY_DRAFT_TEMPLATE = "articles/%d/draft.md";
    public static final String S3_KEY_VERSION_TEMPLATE = "articles/%d/v%d.md";

    // Logging
    public static final String LOG_PREFIX = "[CONTENT]";
}
