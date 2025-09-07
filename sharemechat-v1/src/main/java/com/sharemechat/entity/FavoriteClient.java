package com.sharemechat.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

// FavoriteClient.java
@Entity
@Table(
        name = "favorites_clients",
        uniqueConstraints = @UniqueConstraint(name = "uq_model_client", columnNames = {"model_id","client_id"}),
        indexes = {
                @Index(name = "idx_fav_clients_model",  columnList = "model_id"),
                @Index(name = "idx_fav_clients_client", columnList = "client_id"),
                @Index(name = "idx_fav_clients_created",columnList = "created_at"),
                @Index(name = "idx_fav_clients_status", columnList = "status"),
                @Index(name = "idx_fav_clients_invited",columnList = "invited")
        }
)
public class FavoriteClient {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name="model_id",  nullable=false) private Long modelId;
    @Column(name="client_id", nullable=false) private Long clientId;

    @Column(name="status",   nullable=false) private String status = "active";     // active|inactive
    @Column(name="invited",  nullable=false) private String invited = "accepted";  // accepted|rejected|pending

    @Column(name="created_at", nullable=false,
            columnDefinition="DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name="updated_at", nullable=false,
            columnDefinition="DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    private LocalDateTime updatedAt = LocalDateTime.now();

    public FavoriteClient() {}
    public FavoriteClient(Long modelId, Long clientId) {
        this.modelId = modelId; this.clientId = clientId;
    }
    // getters/setters


    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getModelId() {
        return modelId;
    }

    public void setModelId(Long modelId) {
        this.modelId = modelId;
    }

    public Long getClientId() {
        return clientId;
    }

    public void setClientId(Long clientId) {
        this.clientId = clientId;
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
