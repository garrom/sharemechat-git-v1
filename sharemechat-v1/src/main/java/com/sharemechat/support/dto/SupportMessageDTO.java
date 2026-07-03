package com.sharemechat.support.dto;

import java.time.LocalDateTime;

/**
 * Item de historial para {@code GET /api/support/conversations/{id}/messages}.
 * Solo expone los campos que la UI necesita: id, sender, content y timestamp.
 * NO expone tokens ni coste (informacion interna).
 */
public class SupportMessageDTO {

    private Long id;
    private Long conversationId;
    private String sender;    // USER | LLM | SYSTEM
    private String content;
    private LocalDateTime createdAt;

    public SupportMessageDTO() {}

    public SupportMessageDTO(Long id, Long conversationId, String sender, String content, LocalDateTime createdAt) {
        this.id = id;
        this.conversationId = conversationId;
        this.sender = sender;
        this.content = content;
        this.createdAt = createdAt;
    }

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
}
