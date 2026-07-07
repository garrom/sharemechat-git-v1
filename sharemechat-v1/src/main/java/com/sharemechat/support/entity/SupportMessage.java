package com.sharemechat.support.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "support_messages")
public class SupportMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "conversation_id", nullable = false)
    private Long conversationId;

    @Column(name = "sender", nullable = false, length = 10)
    private String sender;

    @Column(name = "content", nullable = false, length = 4000)
    private String content;

    @Column(name = "tokens_input")
    private Integer tokensInput;

    @Column(name = "tokens_output")
    private Integer tokensOutput;

    @Column(name = "cost_estimate_micros")
    private Long costEstimateMicros;

    @Column(name = "llm_model", length = 50)
    private String llmModel;

    @Column(name = "llm_finish_reason", length = 50)
    private String llmFinishReason;

    @Column(name = "created_at", nullable = false, updatable = false,
            columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt;

    // Frente B.3.1 (ADR-046): autoria humana. Poblados unicamente cuando
    // sender='HUMAN'. Para USER/LLM/SYSTEM permanecen NULL.
    @Column(name = "sent_by_user_id")
    private Long sentByUserId;

    @Column(name = "sent_by_profile_id")
    private Long sentByProfileId;

    public SupportMessage() {
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Long getConversationId() { return conversationId; }
    public void setConversationId(Long conversationId) { this.conversationId = conversationId; }
    public String getSender() { return sender; }
    public void setSender(String sender) { this.sender = sender; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public Integer getTokensInput() { return tokensInput; }
    public void setTokensInput(Integer tokensInput) { this.tokensInput = tokensInput; }
    public Integer getTokensOutput() { return tokensOutput; }
    public void setTokensOutput(Integer tokensOutput) { this.tokensOutput = tokensOutput; }
    public Long getCostEstimateMicros() { return costEstimateMicros; }
    public void setCostEstimateMicros(Long costEstimateMicros) { this.costEstimateMicros = costEstimateMicros; }
    public String getLlmModel() { return llmModel; }
    public void setLlmModel(String llmModel) { this.llmModel = llmModel; }
    public String getLlmFinishReason() { return llmFinishReason; }
    public void setLlmFinishReason(String llmFinishReason) { this.llmFinishReason = llmFinishReason; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public Long getSentByUserId() { return sentByUserId; }
    public void setSentByUserId(Long sentByUserId) { this.sentByUserId = sentByUserId; }
    public Long getSentByProfileId() { return sentByProfileId; }
    public void setSentByProfileId(Long sentByProfileId) { this.sentByProfileId = sentByProfileId; }
}
