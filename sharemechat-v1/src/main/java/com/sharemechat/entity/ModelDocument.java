package com.sharemechat.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "model_documents")
public class ModelDocument {

    @Id
    @Column(name = "user_id")
    private Long userId; // misma PK que users.id

    @Column(name = "url_verific_front", length = 500)
    private String urlVerificFront;

    @Column(name = "url_verific_back", length = 500)
    private String urlVerificBack;

    @Column(name = "url_verific_doc", length = 500)
    private String urlVerificDoc; // PDF multipágina

    @Column(name = "url_consent", length = 500)
    private String urlConsent;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    public void prePersist() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = Instant.now();
    }

    // getters y setters


    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getUrlVerificFront() {
        return urlVerificFront;
    }

    public void setUrlVerificFront(String urlVerificFront) {
        this.urlVerificFront = urlVerificFront;
    }

    public String getUrlVerificBack() {
        return urlVerificBack;
    }

    public void setUrlVerificBack(String urlVerificBack) {
        this.urlVerificBack = urlVerificBack;
    }

    public String getUrlVerificDoc() {
        return urlVerificDoc;
    }

    public void setUrlVerificDoc(String urlVerificDoc) {
        this.urlVerificDoc = urlVerificDoc;
    }

    public String getUrlConsent() {
        return urlConsent;
    }

    public void setUrlConsent(String urlConsent) {
        this.urlConsent = urlConsent;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
