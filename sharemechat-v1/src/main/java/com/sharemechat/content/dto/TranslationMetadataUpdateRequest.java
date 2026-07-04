package com.sharemechat.content.dto;

/**
 * Request del PATCH /api/admin/content/articles/{articleId}/translations/{locale}
 * (paquete 6.5, ADR-025; brief incorporado por ADR-027; keywords SEO per-locale
 * por ADR-045).
 *
 * Edita los campos linguisticos per-locale de una traduccion existente. Solo
 * campos opcionales: cualquiera que llegue como null o ausente se ignora;
 * cualquiera que llegue como string vacio dispara 400. Para el detalle de
 * validaciones (longitudes, formato de slug, unicidad) ver
 * {@code ContentArticleService#updateTranslationMetadata}.
 *
 * Complementa el PATCH compartido {@link ArticleUpdateRequest} (que solo toca
 * campos compartidos del articulo logico). Body se sigue editando por el
 * endpoint dedicado /translations/{locale}/body.
 *
 * Brief (ADR-027): texto descriptivo per-locale visible en el blog publico.
 * Obligatorio al menos en ES para transicion DRAFT -> IN_REVIEW.
 *
 * Keywords SEO (ADR-045 D1/D2/D3/D6):
 *  - primaryKeyword: string simple, max 120 chars. Obligatorio en ES para
 *    lanzar run IA y para DRAFT -> IN_REVIEW; opcional en EN.
 *  - secondaryKeywords: string coma-separado; el service normaliza (trim,
 *    dedup case-insensitive, max 5 elementos, max 120 chars por termino).
 *  El service compone el JSON canonico de content_article_translations.target_keywords.
 */
public class TranslationMetadataUpdateRequest {

    private String title;
    private String slug;
    private String seoTitle;
    private String metaDescription;
    private String brief;
    private String primaryKeyword;
    private String secondaryKeywords;

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }

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
