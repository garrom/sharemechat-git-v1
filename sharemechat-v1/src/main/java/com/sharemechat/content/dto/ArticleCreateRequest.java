package com.sharemechat.content.dto;

public class ArticleCreateRequest {

    private String slug;
    private String locale;
    private String title;
    private String brief;
    private String category;
    private String keywords;
    private Long responsibleEditorUserId;

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
}
