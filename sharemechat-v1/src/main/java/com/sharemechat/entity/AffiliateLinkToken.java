package com.sharemechat.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * ADR-049 Subpasada 1: token del magic link temprano tipo Uber/Airbnb.
 *
 * <p>El visitante mete su email en la landing publica del programa de
 * afiliadas, recibe un email con URL {@code /i/<token>} y al abrirlo en
 * cualquier dispositivo se resetea la cookie de referral en el nuevo
 * navegador. Patron calcado de {@link EmailVerificationToken}: token opaco
 * generado con SecureRandom, hash SHA-256 en BD, consumo idempotente.
 *
 * <p>La verificacion del token compara el hash de la version presentada
 * contra {@code tokenHash}. El token plano nunca se persiste.
 */
@Entity
@Table(name = "affiliate_link_tokens")
public class AffiliateLinkToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** SHA-256 hex del token plano. UNIQUE. */
    @Column(name = "token_hash", nullable = false, length = 64, unique = true)
    private String tokenHash;

    /** userId de la modelo referidora asociada al codigo del click original. */
    @Column(name = "model_user_id", nullable = false)
    private Long modelUserId;

    /** Email opcional que el visitante ha dado. Puede ser NULL. */
    @Column(name = "email", length = 255)
    private String email;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    /** Timestamp del consumo. NULL si el token no se ha usado. */
    @Column(name = "consumed_at")
    private LocalDateTime consumedAt;

    @Column(name = "created_at", nullable = false, updatable = false,
            columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt;

    public AffiliateLinkToken() {
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }

    public String getTokenHash() { return tokenHash; }
    public void setTokenHash(String tokenHash) { this.tokenHash = tokenHash; }

    public Long getModelUserId() { return modelUserId; }
    public void setModelUserId(Long modelUserId) { this.modelUserId = modelUserId; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }

    public LocalDateTime getConsumedAt() { return consumedAt; }
    public void setConsumedAt(LocalDateTime consumedAt) { this.consumedAt = consumedAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
