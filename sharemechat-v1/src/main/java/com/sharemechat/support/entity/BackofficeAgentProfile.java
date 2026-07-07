package com.sharemechat.support.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Identidad de servicio ("mascara publica") con la que un agente humano firma
 * mensajes en el chat de soporte. Vive desacoplada del user real: un mismo user
 * puede tener grant a varias profiles y una profile puede ser compartida por
 * varios users (turno rotativo). Ver ADR-046.
 */
@Entity
@Table(name = "backoffice_agent_profile")
public class BackofficeAgentProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "display_name", nullable = false, length = 80, unique = true)
    private String displayName;

    @Column(name = "active", nullable = false)
    private boolean active;

    /**
     * Hint operativo, sin CHECK. Usado por la UI del selector para agrupar
     * profiles por categoria (TECH/BILLING/GDPR/...). Sin exposicion al cliente.
     */
    @Column(name = "category", length = 40)
    private String category;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "created_at", nullable = false, updatable = false,
            columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false,
            columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    private LocalDateTime updatedAt;

    public BackofficeAgentProfile() {
        this.active = true;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public Long getCreatedBy() { return createdBy; }
    public void setCreatedBy(Long createdBy) { this.createdBy = createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
