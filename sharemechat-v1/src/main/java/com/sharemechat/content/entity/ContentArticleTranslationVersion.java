package com.sharemechat.content.entity;

import jakarta.persistence.*;

/**
 * Snapshot per-idioma de un {@link ContentArticleVersion} (ADR-025).
 *
 * Una fila por locale en cada version del articulo. Captura el slug,
 * title, seo_title, meta_description y la referencia S3 al body en
 * el momento de DRAFT->IN_REVIEW; con N traducciones, una transicion
 * crea N filas en esta tabla.
 *
 * Constraint UNIQUE (version_id, locale) garantiza un solo snapshot
 * por idioma por version.
 */
@Entity
@Table(name = "content_article_translation_versions")
public class ContentArticleTranslationVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "version_id", nullable = false)
    private Long versionId;

    @Column(name = "locale", nullable = false, length = 10)
    private String locale;

    @Column(name = "body_s3_key", nullable = false, length = 500)
    private String bodyS3Key;

    @Column(name = "body_content_hash", nullable = false, length = 64)
    private String bodyContentHash;

    @Column(name = "slug", nullable = false, length = 160)
    private String slug;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "seo_title", length = 60)
    private String seoTitle;

    @Column(name = "meta_description", length = 160)
    private String metaDescription;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getVersionId() { return versionId; }
    public void setVersionId(Long versionId) { this.versionId = versionId; }

    public String getLocale() { return locale; }
    public void setLocale(String locale) { this.locale = locale; }

    public String getBodyS3Key() { return bodyS3Key; }
    public void setBodyS3Key(String bodyS3Key) { this.bodyS3Key = bodyS3Key; }

    public String getBodyContentHash() { return bodyContentHash; }
    public void setBodyContentHash(String bodyContentHash) { this.bodyContentHash = bodyContentHash; }

    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getSeoTitle() { return seoTitle; }
    public void setSeoTitle(String seoTitle) { this.seoTitle = seoTitle; }

    public String getMetaDescription() { return metaDescription; }
    public void setMetaDescription(String metaDescription) { this.metaDescription = metaDescription; }
}
