package com.sharemechat.content.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "content_generation_runs")
public class ContentGenerationRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "article_id", nullable = false)
    private Long articleId;

    @Column(name = "model_provider", nullable = false, length = 40)
    private String modelProvider;

    @Column(name = "model_id", nullable = false, length = 80)
    private String modelId;

    @Column(name = "model_version", length = 80)
    private String modelVersion;

    @Column(name = "prompt_template_id", length = 80)
    private String promptTemplateId;

    @Column(name = "prompt_s3_key", length = 500)
    private String promptS3Key;

    @Column(name = "prompt_hash", length = 64)
    private String promptHash;

    @Column(name = "output_s3_key", length = 500)
    private String outputS3Key;

    @Column(name = "output_hash", length = 64)
    private String outputHash;

    @Column(name = "output_validated", nullable = false)
    private boolean outputValidated;

    @Column(name = "tokens_input")
    private Integer tokensInput;

    @Column(name = "tokens_output")
    private Integer tokensOutput;

    @Column(name = "estimated_cost_eur")
    private BigDecimal estimatedCostEur;

    @Column(name = "triggered_by_user_id")
    private Long triggeredByUserId;

    @Column(name = "mode", nullable = false, length = 30)
    private String mode;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getArticleId() { return articleId; }
    public void setArticleId(Long articleId) { this.articleId = articleId; }

    public String getModelProvider() { return modelProvider; }
    public void setModelProvider(String modelProvider) { this.modelProvider = modelProvider; }

    public String getModelId() { return modelId; }
    public void setModelId(String modelId) { this.modelId = modelId; }

    public String getModelVersion() { return modelVersion; }
    public void setModelVersion(String modelVersion) { this.modelVersion = modelVersion; }

    public String getPromptTemplateId() { return promptTemplateId; }
    public void setPromptTemplateId(String promptTemplateId) { this.promptTemplateId = promptTemplateId; }

    public String getPromptS3Key() { return promptS3Key; }
    public void setPromptS3Key(String promptS3Key) { this.promptS3Key = promptS3Key; }

    public String getPromptHash() { return promptHash; }
    public void setPromptHash(String promptHash) { this.promptHash = promptHash; }

    public String getOutputS3Key() { return outputS3Key; }
    public void setOutputS3Key(String outputS3Key) { this.outputS3Key = outputS3Key; }

    public String getOutputHash() { return outputHash; }
    public void setOutputHash(String outputHash) { this.outputHash = outputHash; }

    public boolean isOutputValidated() { return outputValidated; }
    public void setOutputValidated(boolean outputValidated) { this.outputValidated = outputValidated; }

    public Integer getTokensInput() { return tokensInput; }
    public void setTokensInput(Integer tokensInput) { this.tokensInput = tokensInput; }

    public Integer getTokensOutput() { return tokensOutput; }
    public void setTokensOutput(Integer tokensOutput) { this.tokensOutput = tokensOutput; }

    public BigDecimal getEstimatedCostEur() { return estimatedCostEur; }
    public void setEstimatedCostEur(BigDecimal estimatedCostEur) { this.estimatedCostEur = estimatedCostEur; }

    public Long getTriggeredByUserId() { return triggeredByUserId; }
    public void setTriggeredByUserId(Long triggeredByUserId) { this.triggeredByUserId = triggeredByUserId; }

    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Instant getCreatedAt() { return createdAt; }
}
