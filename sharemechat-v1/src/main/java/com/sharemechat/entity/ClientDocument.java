package com.sharemechat.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "client_documents")
public class ClientDocument {

    @Id
    @Column(name = "user_id")
    private Long userId; // misma PK que users.id

    @Column(name = "url_pic", length = 500)
    private String urlPic;

    @Column(name = "created_at", updatable = false)
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

    // Getters / Setters
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getUrlPic() { return urlPic; }
    public void setUrlPic(String urlPic) { this.urlPic = urlPic; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
