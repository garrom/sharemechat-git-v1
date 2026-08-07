package com.sharemechat.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "message_translations",
       uniqueConstraints = @UniqueConstraint(
           name = "uk_message_translations_msg_lang",
           columnNames = {"message_id", "target_lang"}
       ))
public class MessageTranslation {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "message_id", nullable = false)
    private Long messageId;

    @Column(name = "target_lang", nullable = false, length = 5)
    private String targetLang;

    @Column(name = "translated_text", nullable = false, length = 2000)
    private String translatedText;

    @Column(name = "provider", nullable = false, length = 20)
    private String provider;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public MessageTranslation() {}

    public MessageTranslation(Long messageId, String targetLang, String translatedText, String provider) {
        this.messageId = messageId;
        this.targetLang = targetLang;
        this.translatedText = translatedText;
        this.provider = provider;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getMessageId() { return messageId; }
    public void setMessageId(Long messageId) { this.messageId = messageId; }

    public String getTargetLang() { return targetLang; }
    public void setTargetLang(String targetLang) { this.targetLang = targetLang; }

    public String getTranslatedText() { return translatedText; }
    public void setTranslatedText(String translatedText) { this.translatedText = translatedText; }

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
