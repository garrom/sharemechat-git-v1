package com.sharemechat.content.dto;

/**
 * Request del PATCH /api/admin/content/articles/{id} (ADR-025, brief reubicado por ADR-027).
 *
 * Solo campos COMPARTIDOS del articulo logico:
 *  - category: codigo canonico (safety, setup, business, ...).
 *  - keywords: keywords-operador (taxonomia canonica).
 *  - heroImageUrl: imagen 4:3 del articulo.
 *  - responsibleEditorUserId: editor humano responsable.
 *
 * Los campos linguisticos (slug, title, seo_title, meta_description,
 * brief, body) viven en {@link ContentArticleTranslation} y se editan
 * por el endpoint dedicado por locale ({@link TranslationMetadataUpdateRequest}
 * para metadata y endpoint /body para el body), NO aqui.
 */
public class ArticleUpdateRequest {

    private String category;
    private String keywords;
    private String heroImageUrl;
    private Long responsibleEditorUserId;

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getKeywords() { return keywords; }
    public void setKeywords(String keywords) { this.keywords = keywords; }

    public String getHeroImageUrl() { return heroImageUrl; }
    public void setHeroImageUrl(String heroImageUrl) { this.heroImageUrl = heroImageUrl; }

    public Long getResponsibleEditorUserId() { return responsibleEditorUserId; }
    public void setResponsibleEditorUserId(Long responsibleEditorUserId) {
        this.responsibleEditorUserId = responsibleEditorUserId;
    }
}
