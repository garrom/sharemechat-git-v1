package com.sharemechat.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

// FavoriteModel.java
@Entity
@Table(
        name = "favorites_models",
        uniqueConstraints = @UniqueConstraint(name = "uq_client_model", columnNames = {"client_id","model_id"}),
        indexes = {
                @Index(name = "idx_fav_models_client", columnList = "client_id"),
                @Index(name = "idx_fav_models_model",  columnList = "model_id"),
                @Index(name = "idx_fav_models_created",columnList = "created_at"),
                @Index(name = "idx_fav_models_status", columnList = "status"),
                @Index(name = "idx_fav_models_invited",columnList = "invited")
        }
)
public class FavoriteModel {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name="client_id", nullable=false) private Long clientId;
    @Column(name="model_id",  nullable=false) private Long modelId;

    @Column(name="status",   nullable=false) private String status = "active";
    @Column(name="invited",  nullable=false) private String invited = "pending";

    @Column(name="created_at", nullable=false,
            columnDefinition="DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name="updated_at", nullable=false,
            columnDefinition="DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    private LocalDateTime updatedAt = LocalDateTime.now();

    public FavoriteModel() {}
    public FavoriteModel(Long clientId, Long modelId) {
        this.clientId = clientId; this.modelId = modelId;
    }
    // getters/setters


    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getClientId() {
        return clientId;
    }

    public void setClientId(Long clientId) {
        this.clientId = clientId;
    }

    public Long getModelId() {
        return modelId;
    }

    public void setModelId(Long modelId) {
        this.modelId = modelId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getInvited() {
        return invited;
    }

    public void setInvited(String invited) {
        this.invited = invited;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}

