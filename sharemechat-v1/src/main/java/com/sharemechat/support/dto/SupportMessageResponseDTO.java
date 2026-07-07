package com.sharemechat.support.dto;

import java.time.LocalDateTime;

public class SupportMessageResponseDTO {

    private Long conversationId;
    private Long messageId;
    private String reply;
    private String resolutionStatus;
    private Boolean rateLimited;
    private Boolean escalated;
    // Frente B.3.1 (ADR-046): true cuando la conversacion tiene claim humano
    // activo. En ese caso reply=null y el usuario espera respuesta manual.
    private Boolean humanHandling;
    private String escalationReason;
    private Integer messagesRemainingToday;
    private Long tokensRemainingToday;
    private LocalDateTime timestamp;

    public Long getConversationId() { return conversationId; }
    public void setConversationId(Long conversationId) { this.conversationId = conversationId; }
    public Long getMessageId() { return messageId; }
    public void setMessageId(Long messageId) { this.messageId = messageId; }
    public String getReply() { return reply; }
    public void setReply(String reply) { this.reply = reply; }
    public String getResolutionStatus() { return resolutionStatus; }
    public void setResolutionStatus(String resolutionStatus) { this.resolutionStatus = resolutionStatus; }
    public Boolean getRateLimited() { return rateLimited; }
    public void setRateLimited(Boolean rateLimited) { this.rateLimited = rateLimited; }
    public Boolean getEscalated() { return escalated; }
    public void setEscalated(Boolean escalated) { this.escalated = escalated; }
    public Boolean getHumanHandling() { return humanHandling; }
    public void setHumanHandling(Boolean humanHandling) { this.humanHandling = humanHandling; }
    public String getEscalationReason() { return escalationReason; }
    public void setEscalationReason(String escalationReason) { this.escalationReason = escalationReason; }
    public Integer getMessagesRemainingToday() { return messagesRemainingToday; }
    public void setMessagesRemainingToday(Integer messagesRemainingToday) { this.messagesRemainingToday = messagesRemainingToday; }
    public Long getTokensRemainingToday() { return tokensRemainingToday; }
    public void setTokensRemainingToday(Long tokensRemainingToday) { this.tokensRemainingToday = tokensRemainingToday; }
    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }
}
