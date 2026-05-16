package com.sharemechat.content.entity;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * Snapshot del articulo logico en una transicion DRAFT->IN_REVIEW
 * (ADR-025).
 *
 * Modelo bilingue: una fila aqui representa la version N del articulo
 * completo (con TODOS sus locales); el contenido por idioma vive en
 * {@link ContentArticleTranslationVersion} con N filas por version
 * (una por locale).
 *
 * Esta tabla pierde respecto al modelo previo los campos body_s3_key
 * y body_content_hash; ahora son per-locale y viven en la tabla hija.
 */
@Entity
@Table(name = "content_article_versions")
public class ContentArticleVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "article_id", nullable = false)
    private Long articleId;

    @Column(name = "version_number", nullable = false)
    private Integer versionNumber;

    @Column(name = "source_run_id")
    private Long sourceRunId;

    @Column(name = "created_by_user_id", nullable = false)
    private Long createdByUserId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getArticleId() { return articleId; }
    public void setArticleId(Long articleId) { this.articleId = articleId; }

    public Integer getVersionNumber() { return versionNumber; }
    public void setVersionNumber(Integer versionNumber) { this.versionNumber = versionNumber; }

    public Long getSourceRunId() { return sourceRunId; }
    public void setSourceRunId(Long sourceRunId) { this.sourceRunId = sourceRunId; }

    public Long getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(Long createdByUserId) { this.createdByUserId = createdByUserId; }

    public Instant getCreatedAt() { return createdAt; }
}
