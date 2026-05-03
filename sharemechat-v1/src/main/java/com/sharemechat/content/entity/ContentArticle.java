package com.sharemechat.content.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "content_articles")
public class ContentArticle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "slug", nullable = false, length = 160)
    private String slug;

    @Column(name = "locale", nullable = false, length = 10)
    private String locale;

    @Column(name = "parent_article_id")
    private Long parentArticleId;

    @Column(name = "state", nullable = false, length = 30)
    private String state;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "brief", columnDefinition = "TEXT")
    private String brief;

    @Column(name = "category", length = 80)
    private String category;

    @Column(name = "keywords", columnDefinition = "JSON")
    private String keywords;

    @Column(name = "responsible_editor_user_id")
    private Long responsibleEditorUserId;

    @Column(name = "current_version_id")
    private Long currentVersionId;

    @Column(name = "body_s3_key", length = 500)
    private String bodyS3Key;

    @Column(name = "body_content_hash", length = 64)
    private String bodyContentHash;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "scheduled_for")
    private Instant scheduledFor;

    @Column(name = "retracted_at")
    private Instant retractedAt;

    @Column(name = "ai_assisted", nullable = false)
    private boolean aiAssisted;

    @Column(name = "disclosure_required", nullable = false)
    private boolean disclosureRequired;

    @Column(name = "created_by_user_id")
    private Long createdByUserId;

    @Column(name = "updated_by_user_id")
    private Long updatedByUserId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }

    public String getLocale() { return locale; }
    public void setLocale(String locale) { this.locale = locale; }

    public Long getParentArticleId() { return parentArticleId; }
    public void setParentArticleId(Long parentArticleId) { this.parentArticleId = parentArticleId; }

    public String getState() { return state; }
    public void setState(String state) { this.state = state; }

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

    public Long getCurrentVersionId() { return currentVersionId; }
    public void setCurrentVersionId(Long currentVersionId) { this.currentVersionId = currentVersionId; }

    public String getBodyS3Key() { return bodyS3Key; }
    public void setBodyS3Key(String bodyS3Key) { this.bodyS3Key = bodyS3Key; }

    public String getBodyContentHash() { return bodyContentHash; }
    public void setBodyContentHash(String bodyContentHash) { this.bodyContentHash = bodyContentHash; }

    public Instant getPublishedAt() { return publishedAt; }
    public void setPublishedAt(Instant publishedAt) { this.publishedAt = publishedAt; }

    public Instant getScheduledFor() { return scheduledFor; }
    public void setScheduledFor(Instant scheduledFor) { this.scheduledFor = scheduledFor; }

    public Instant getRetractedAt() { return retractedAt; }
    public void setRetractedAt(Instant retractedAt) { this.retractedAt = retractedAt; }

    public boolean isAiAssisted() { return aiAssisted; }
    public void setAiAssisted(boolean aiAssisted) { this.aiAssisted = aiAssisted; }

    public boolean isDisclosureRequired() { return disclosureRequired; }
    public void setDisclosureRequired(boolean disclosureRequired) { this.disclosureRequired = disclosureRequired; }

    public Long getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(Long createdByUserId) { this.createdByUserId = createdByUserId; }

    public Long getUpdatedByUserId() { return updatedByUserId; }
    public void setUpdatedByUserId(Long updatedByUserId) { this.updatedByUserId = updatedByUserId; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
