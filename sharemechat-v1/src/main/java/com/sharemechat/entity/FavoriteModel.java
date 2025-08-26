package com.sharemechat.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "favorites_models",
        uniqueConstraints = @UniqueConstraint(name = "uq_client_model", columnNames = {"client_id","model_id"}),
        indexes = {
                @Index(name = "idx_fav_models_client", columnList = "client_id"),
                @Index(name = "idx_fav_models_model", columnList = "model_id"),
                @Index(name = "idx_fav_models_created", columnList = "created_at")
        }
)
public class FavoriteModel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "client_id", nullable = false)
    private Long clientId;

    @Column(name = "model_id", nullable = false)
    private Long modelId;

    @Column(name = "created_at", nullable = false, columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt = LocalDateTime.now();

    public FavoriteModel() {}

    public FavoriteModel(Long clientId, Long modelId) {
        this.clientId = clientId;
        this.modelId = modelId;
    }

    // getters/setters
    public Long getId() { return id; }
    public Long getClientId() { return clientId; }
    public Long getModelId() { return modelId; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public void setId(Long id) { this.id = id; }
    public void setClientId(Long clientId) { this.clientId = clientId; }
    public void setModelId(Long modelId) { this.modelId = modelId; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
