package com.sharemechat.content.dto;

/**
 * Request del POST /api/admin/content/articles/{articleId}/translations
 * (ADR-045 subpasada 2C.0; cierra known-debt #D-8).
 *
 * Instancia una traduccion en un locale para un articulo existente ANTES
 * del primer apply-bilingual. Permite que el operador declare keywords
 * per-locale (obligatorio en ES por gate ADR-045 D3; opcional en EN para
 * validar la rama "operador honra" del pipeline) desde la UI sin depender
 * del pipeline IA.
 *
 * Semantica idempotente: si ya existe traduccion (articleId, locale), la
 * llamada devuelve 409 CONFLICT (no upsert). Para modificar una translation
 * existente, usar PATCH /articles/{articleId}/translations/{locale}.
 *
 * Campos obligatorios (400 si null o vacio):
 *  - locale: string en el set permitido (es | en).
 *  - slug:   string kebab-case, <=160 chars, unico global por locale.
 *  - title:  string <=255 chars.
 *
 * Campos opcionales (null: no setea; "" dispara 400 salvo secondaryKeywords):
 *  - seoTitle:         <=60 chars.
 *  - metaDescription:  <=160 chars.
 *  - brief:            <=8192 chars.
 *  - primaryKeyword:   <=120 chars.
 *  - secondaryKeywords: coma-separada; el service normaliza (trim, dedup CI,
 *    cap 5, max 120 chars por termino). "" se interpreta como lista vacia
 *    (mismo patron que TranslationMetadataUpdateRequest).
 */
public class TranslationCreateRequest {

    private String locale;
    private String slug;
    private String title;
    private String seoTitle;
    private String metaDescription;
    private String brief;
    private String primaryKeyword;
    private String secondaryKeywords;

    public String getLocale() { return locale; }
    public void setLocale(String locale) { this.locale = locale; }

    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getSeoTitle() { return seoTitle; }
    public void setSeoTitle(String seoTitle) { this.seoTitle = seoTitle; }

    public String getMetaDescription() { return metaDescription; }
    public void setMetaDescription(String metaDescription) { this.metaDescription = metaDescription; }

    public String getBrief() { return brief; }
    public void setBrief(String brief) { this.brief = brief; }

    public String getPrimaryKeyword() { return primaryKeyword; }
    public void setPrimaryKeyword(String primaryKeyword) { this.primaryKeyword = primaryKeyword; }

    public String getSecondaryKeywords() { return secondaryKeywords; }
    public void setSecondaryKeywords(String secondaryKeywords) { this.secondaryKeywords = secondaryKeywords; }
}
