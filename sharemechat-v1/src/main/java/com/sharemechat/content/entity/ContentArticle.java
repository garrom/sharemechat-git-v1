package com.sharemechat.content.entity;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * Articulo logico, invariante por idioma (ADR-025).
 *
 * Modelo bilingue ES+EN: los campos linguisticos (slug, title, body)
 * viven en {@link ContentArticleTranslation}, una fila por locale.
 * Esta entidad mantiene los campos compartidos: hero, category,
 * keywords-operador, brief, ciclo de vida y autoria.
 */
@Entity
@Table(name = "content_articles")
public class ContentArticle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "hero_image_url", length = 500)
    private String heroImageUrl;

    @Column(name = "category", length = 80)
    private String category;

    @Column(name = "keywords", columnDefinition = "JSON")
    private String keywords;

    @Column(name = "brief", columnDefinition = "TEXT")
    private String brief;

    @Column(name = "state", nullable = false, length = 30)
    private String state;

    @Column(name = "ai_assisted", nullable = false)
    private boolean aiAssisted;

    @Column(name = "disclosure_required", nullable = false)
    private boolean disclosureRequired;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "scheduled_for")
    private Instant scheduledFor;

    @Column(name = "retracted_at")
    private Instant retractedAt;

    @Column(name = "current_version_id")
    private Long currentVersionId;

    @Column(name = "responsible_editor_user_id")
    private Long responsibleEditorUserId;

    @Column(name = "created_by_user_id", nullable = false)
    private Long createdByUserId;

    @Column(name = "updated_by_user_id", nullable = false)
    private Long updatedByUserId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getHeroImageUrl() { return heroImageUrl; }
    public void setHeroImageUrl(String heroImageUrl) { this.heroImageUrl = heroImageUrl; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getKeywords() { return keywords; }
    public void setKeywords(String keywords) { this.keywords = keywords; }

    public String getBrief() { return brief; }
    public void setBrief(String brief) { this.brief = brief; }

    public String getState() { return state; }
    public void setState(String state) { this.state = state; }

    public boolean isAiAssisted() { return aiAssisted; }
    public void setAiAssisted(boolean aiAssisted) { this.aiAssisted = aiAssisted; }

    public boolean isDisclosureRequired() { return disclosureRequired; }
    public void setDisclosureRequired(boolean disclosureRequired) { this.disclosureRequired = disclosureRequired; }

    public Instant getPublishedAt() { return publishedAt; }
    public void setPublishedAt(Instant publishedAt) { this.publishedAt = publishedAt; }

    public Instant getScheduledFor() { return scheduledFor; }
    public void setScheduledFor(Instant scheduledFor) { this.scheduledFor = scheduledFor; }

    public Instant getRetractedAt() { return retractedAt; }
    public void setRetractedAt(Instant retractedAt) { this.retractedAt = retractedAt; }

    public Long getCurrentVersionId() { return currentVersionId; }
    public void setCurrentVersionId(Long currentVersionId) { this.currentVersionId = currentVersionId; }

    public Long getResponsibleEditorUserId() { return responsibleEditorUserId; }
    public void setResponsibleEditorUserId(Long responsibleEditorUserId) {
        this.responsibleEditorUserId = responsibleEditorUserId;
    }

    public Long getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(Long createdByUserId) { this.createdByUserId = createdByUserId; }

    public Long getUpdatedByUserId() { return updatedByUserId; }
    public void setUpdatedByUserId(Long updatedByUserId) { this.updatedByUserId = updatedByUserId; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
