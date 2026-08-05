package com.sharemechat.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * ADR pendiente (2026-08-05): login federado con Sign in with Google.
 * Vincula un {@link User} a una cuenta externa de un proveedor OIDC
 * (google, apple, twitter). Un user puede tener 0..N oauth_accounts;
 * el par (provider, providerUserId) es unico globalmente.
 *
 * <p>Los campos {@code emailAtSignup}, {@code googleHd} y {@code pictureUrl}
 * se congelan en el momento del signup y se mantienen como referencia
 * historica; el email vivo del user vive en users.email.
 *
 * <p>{@code providerUserId} para Google es el claim {@code sub} del ID token,
 * identificador estable y unico por vida de la cuenta Google (segun doc
 * oficial: "The sub field is a globally unique identifier for the Google
 * Account... unique among all Google Accounts and never reused").
 */
@Entity
@Table(name = "oauth_accounts")
public class OAuthAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "provider", nullable = false, length = 20)
    private String provider;

    @Column(name = "provider_user_id", nullable = false, length = 255)
    private String providerUserId;

    @Column(name = "email_at_signup", nullable = false, length = 255)
    private String emailAtSignup;

    /** Google Hosted Domain (claim {@code hd}). Presente si la cuenta pertenece
     *  a un Workspace corporativo, ej. "acme.com". Null para Gmail personal. */
    @Column(name = "google_hd", length = 128)
    private String googleHd;

    @Column(name = "picture_url", length = 500)
    private String pictureUrl;

    @Column(name = "created_at", nullable = false, updatable = false,
            columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt;

    @Column(name = "last_used_at")
    private LocalDateTime lastUsedAt;

    /** Timestamp de unlink (usuario retiro la vinculacion). Cuando NOT NULL,
     *  el user NO puede loguearse con este provider hasta re-vincular. */
    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;

    public OAuthAccount() {
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }

    public String getProviderUserId() { return providerUserId; }
    public void setProviderUserId(String providerUserId) { this.providerUserId = providerUserId; }

    public String getEmailAtSignup() { return emailAtSignup; }
    public void setEmailAtSignup(String emailAtSignup) { this.emailAtSignup = emailAtSignup; }

    public String getGoogleHd() { return googleHd; }
    public void setGoogleHd(String googleHd) { this.googleHd = googleHd; }

    public String getPictureUrl() { return pictureUrl; }
    public void setPictureUrl(String pictureUrl) { this.pictureUrl = pictureUrl; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getLastUsedAt() { return lastUsedAt; }
    public void setLastUsedAt(LocalDateTime lastUsedAt) { this.lastUsedAt = lastUsedAt; }

    public LocalDateTime getRevokedAt() { return revokedAt; }
    public void setRevokedAt(LocalDateTime revokedAt) { this.revokedAt = revokedAt; }
}
