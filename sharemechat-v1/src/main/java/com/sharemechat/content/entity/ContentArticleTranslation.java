package com.sharemechat.content.entity;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * Cara per-idioma de un {@link ContentArticle} (ADR-025, brief incorporado por ADR-027).
 *
 * Cada articulo logico tiene N filas en esta tabla, una por locale
 * (es, en, futuro fr/de/it). Constraint UNIQUE (article_id, locale)
 * garantiza un solo registro por idioma; UNIQUE (slug, locale)
 * garantiza slug global unico por idioma.
 *
 * Campos de body opcionales en DRAFT; obligatorios en service para
 * permitir DRAFT -> IN_REVIEW. Esa exigencia se valida en capa de
 * servicio, no en BD.
 *
 * Campo `brief` (ADR-027): texto descriptivo per-locale visible en el
 * blog publico (listado y detalle). Obligatorio al menos en locale ES
 * para transicion DRAFT -> IN_REVIEW; opcional en otros locales.
 */
@Entity
@Table(name = "content_article_translations")
public class ContentArticleTranslation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "article_id", nullable = false)
    private Long articleId;

    @Column(name = "locale", nullable = false, length = 10)
    private String locale;

    @Column(name = "slug", nullable = false, length = 160)
    private String slug;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "seo_title", length = 60)
    private String seoTitle;

    @Column(name = "meta_description", length = 160)
    private String metaDescription;

    @Column(name = "brief", columnDefinition = "TEXT")
    private String brief;

    @Column(name = "body_s3_key", length = 500)
    private String bodyS3Key;

    @Column(name = "body_content_hash", length = 64)
    private String bodyContentHash;

    @Column(name = "target_keywords", columnDefinition = "JSON")
    private String targetKeywords;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getArticleId() { return articleId; }
    public void setArticleId(Long articleId) { this.articleId = articleId; }

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

    public String getBodyS3Key() { return bodyS3Key; }
    public void setBodyS3Key(String bodyS3Key) { this.bodyS3Key = bodyS3Key; }

    public String getBodyContentHash() { return bodyContentHash; }
    public void setBodyContentHash(String bodyContentHash) { this.bodyContentHash = bodyContentHash; }

    public String getTargetKeywords() { return targetKeywords; }
    public void setTargetKeywords(String targetKeywords) { this.targetKeywords = targetKeywords; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
