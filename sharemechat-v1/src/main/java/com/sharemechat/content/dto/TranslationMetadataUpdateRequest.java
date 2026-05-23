package com.sharemechat.content.dto;

/**
 * Request del PATCH /api/admin/content/articles/{articleId}/translations/{locale}
 * (paquete 6.5, ADR-025; brief incorporado por ADR-027).
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
 */
public class TranslationMetadataUpdateRequest {

    private String title;
    private String slug;
    private String seoTitle;
    private String metaDescription;
    private String brief;

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
}
