package com.sharemechat.content.entity;

import jakarta.persistence.*;
import java.time.Instant;

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

    @Column(name = "body_s3_key", nullable = false, length = 500)
    private String bodyS3Key;

    @Column(name = "body_content_hash", nullable = false, length = 64)
    private String bodyContentHash;

    @Column(name = "source_run_id")
    private Long sourceRunId;

    @Column(name = "created_by_user_id")
    private Long createdByUserId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getArticleId() { return articleId; }
    public void setArticleId(Long articleId) { this.articleId = articleId; }

    public Integer getVersionNumber() { return versionNumber; }
    public void setVersionNumber(Integer versionNumber) { this.versionNumber = versionNumber; }

    public String getBodyS3Key() { return bodyS3Key; }
    public void setBodyS3Key(String bodyS3Key) { this.bodyS3Key = bodyS3Key; }

    public String getBodyContentHash() { return bodyContentHash; }
    public void setBodyContentHash(String bodyContentHash) { this.bodyContentHash = bodyContentHash; }

    public Long getSourceRunId() { return sourceRunId; }
    public void setSourceRunId(Long sourceRunId) { this.sourceRunId = sourceRunId; }

    public Long getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(Long createdByUserId) { this.createdByUserId = createdByUserId; }

    public Instant getCreatedAt() { return createdAt; }
}
