package com.sharemechat.support.dto;

import java.time.LocalDateTime;

/**
 * Mensaje de conversacion en vista admin. A diferencia del DTO de user
 * ({@link SupportMessageDTO}) expone sent_by_user_id, sent_by_profile_id y
 * el display_name de la profile firmante (join). Ver ADR-046.
 */
public class SupportMessageAdminDTO {

    private Long id;
    private Long conversationId;
    private String sender;
    private String content;
    private LocalDateTime createdAt;
    private Long sentByUserId;
    private Long sentByProfileId;
    private String sentByProfileDisplayName;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getConversationId() { return conversationId; }
    public void setConversationId(Long conversationId) { this.conversationId = conversationId; }
    public String getSender() { return sender; }
    public void setSender(String sender) { this.sender = sender; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public Long getSentByUserId() { return sentByUserId; }
    public void setSentByUserId(Long sentByUserId) { this.sentByUserId = sentByUserId; }
    public Long getSentByProfileId() { return sentByProfileId; }
    public void setSentByProfileId(Long sentByProfileId) { this.sentByProfileId = sentByProfileId; }
    public String getSentByProfileDisplayName() { return sentByProfileDisplayName; }
    public void setSentByProfileDisplayName(String sentByProfileDisplayName) { this.sentByProfileDisplayName = sentByProfileDisplayName; }
}
