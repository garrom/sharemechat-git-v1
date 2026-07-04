package com.sharemechat.content.dto;

/**
 * Request del POST /api/admin/content/articles (ADR-025; brief reubicado por
 * ADR-027; keywords SEO per-locale por ADR-045).
 *
 * Crea el articulo logico + su primera traduccion (locale primario indicado por
 * {@link #locale}, normalmente "es"). Los campos linguisticos (slug, title,
 * brief, primaryKeyword, secondaryKeywords) acompanan a la primera traduccion
 * y se persisten en content_article_translations; los demas (category,
 * keywords legacy, heroImageUrl, responsibleEditorUserId) son compartidos del
 * articulo logico.
 *
 * Keywords SEO (ADR-045): primaryKeyword y secondaryKeywords se aplican al
 * locale primario ES; el service los normaliza y compone el JSON
 * {@code target_keywords} de la primera translation.
 */
public class ArticleCreateRequest {

    private String slug;
    private String locale;
    private String title;
    private String brief;
    private String category;
    private String keywords;
    private Long responsibleEditorUserId;
    private String heroImageUrl;
    private String primaryKeyword;
    private String secondaryKeywords;

    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }

    public String getLocale() { return locale; }
    public void setLocale(String locale) { this.locale = locale; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getBrief() { return brief; }
    public void setBrief(String brief) { this.brief = brief; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getKeywords() { return keywords; }
    public void setKeywords(String keywords) { this.keywords = keywords; }

    public Long getResponsibleEditorUserId() { return responsibleEditorUserId; }
    public void setResponsibleEditorUserId(Long responsibleEditorUserId) {
        this.responsibleEditorUserId = responsibleEditorUserId;
    }

    public String getHeroImageUrl() { return heroImageUrl; }
    public void setHeroImageUrl(String heroImageUrl) { this.heroImageUrl = heroImageUrl; }

    public String getPrimaryKeyword() { return primaryKeyword; }
    public void setPrimaryKeyword(String primaryKeyword) { this.primaryKeyword = primaryKeyword; }

    public String getSecondaryKeywords() { return secondaryKeywords; }
    public void setSecondaryKeywords(String secondaryKeywords) { this.secondaryKeywords = secondaryKeywords; }
}
