package com.sharemechat.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "messages", indexes = {
        @Index(name = "idx_messages_conv_created", columnList = "conversationKey, createdAt DESC"),
        @Index(name = "idx_messages_sender_created", columnList = "senderId, createdAt DESC")
})
public class Message {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name="conversation_key", nullable=false, length=64)
    private String conversationKey;

    @Column(name="sender_id", nullable=false)
    private Long senderId;

    @Column(name="recipient_id", nullable=false)
    private Long recipientId;

    @Column(name="body", nullable=false, length=1000)
    private String body;

    @Column(name="created_at", nullable=false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name="read_at")
    private LocalDateTime readAt;

    @Column(columnDefinition = "jsonb")
    private String meta;

    // getters & setters


    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getConversationKey() {
        return conversationKey;
    }

    public void setConversationKey(String conversationKey) {
        this.conversationKey = conversationKey;
    }

    public Long getSenderId() {
        return senderId;
    }

    public void setSenderId(Long senderId) {
        this.senderId = senderId;
    }

    public Long getRecipientId() {
        return recipientId;
    }

    public void setRecipientId(Long recipientId) {
        this.recipientId = recipientId;
    }

    public String getBody() {
        return body;
    }

    public void setBody(String body) {
        this.body = body;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getReadAt() {
        return readAt;
    }

    public void setReadAt(LocalDateTime readAt) {
        this.readAt = readAt;
    }

    public String getMeta() {
        return meta;
    }

    public void setMeta(String meta) {
        this.meta = meta;
    }
}
