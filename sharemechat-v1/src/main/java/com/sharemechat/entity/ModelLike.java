package com.sharemechat.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Like de un cliente a una modelo (Card 1 Fase 3). Un par
 * (client_user_id, model_user_id) es único (anti-abuso estructural: 1 like
 * por cliente y modelo). El contador de likes de una modelo se obtiene con
 * COUNT(*); la insignia se resuelve en {@code ModelLikeService} contra la
 * escalera de umbrales.
 */
@Entity
@Table(
        name = "model_likes",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_model_likes_pair",
                columnNames = {"client_user_id", "model_user_id"})
)
public class ModelLike {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "client_user_id", nullable = false)
    private Long clientUserId;

    @Column(name = "model_user_id", nullable = false)
    private Long modelUserId;

    // Gestionado por MySQL (DEFAULT CURRENT_TIMESTAMP).
    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public ModelLike() {
    }

    public ModelLike(Long clientUserId, Long modelUserId) {
        this.clientUserId = clientUserId;
        this.modelUserId = modelUserId;
    }

    public Long getId() { return id; }

    public Long getClientUserId() { return clientUserId; }
    public void setClientUserId(Long clientUserId) { this.clientUserId = clientUserId; }

    public Long getModelUserId() { return modelUserId; }
    public void setModelUserId(Long modelUserId) { this.modelUserId = modelUserId; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
