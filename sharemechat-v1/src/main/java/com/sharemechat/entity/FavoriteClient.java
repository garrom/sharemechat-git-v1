package com.sharemechat.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "favorites_clients",
        uniqueConstraints = @UniqueConstraint(name = "uq_model_client", columnNames = {"model_id","client_id"}),
        indexes = {
                @Index(name = "idx_fav_clients_model", columnList = "model_id"),
                @Index(name = "idx_fav_clients_client", columnList = "client_id"),
                @Index(name = "idx_fav_clients_created", columnList = "created_at")
        }
)
public class FavoriteClient {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "model_id", nullable = false)
    private Long modelId;

    @Column(name = "client_id", nullable = false)
    private Long clientId;

    @Column(name = "created_at", nullable = false, columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt = LocalDateTime.now();

    public FavoriteClient() {}

    public FavoriteClient(Long modelId, Long clientId) {
        this.modelId = modelId;
        this.clientId = clientId;
    }

    // getters/setters
    public Long getId() { return id; }
    public Long getModelId() { return modelId; }
    public Long getClientId() { return clientId; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public void setId(Long id) { this.id = id; }
    public void setModelId(Long modelId) { this.modelId = modelId; }
    public void setClientId(Long clientId) { this.clientId = clientId; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
