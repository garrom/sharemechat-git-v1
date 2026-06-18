package com.sharemechat.streammoderation.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Configuracion del proveedor activo del pipeline de moderacion visual
 * del streaming (frente moderacion IA; ver ADR-030, ADR-036, ADR-037).
 *
 * <p>Calca {@code KycProviderConfig}: 1 fila por dominio, columna
 * {@code provider_key} unica (valor canonico
 * {@code STREAM_VISUAL_MODERATION} en
 * {@link com.sharemechat.constants.Constants.StreamModerationProviderKeys}),
 * {@code active_mode} indica el modo activo (MOCK / SIGHTENGINE /
 * HIVE / REKOGNITION) y se puede cambiar en runtime sin redeploy.
 *
 * <p>Patron vendor-agnostic: el nombre del vendor solo aparece como
 * valor literal en la columna {@code active_mode}; entidad, tabla y
 * columnas son agnostic.
 */
@Entity
@Table(name = "stream_moderation_provider_config")
public class StreamModerationProviderConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "provider_key", nullable = false, length = 50, unique = true)
    private String providerKey;

    @Column(name = "active_mode", nullable = false, length = 20)
    private String activeMode;

    @Column(name = "enabled", nullable = false)
    private boolean enabled = true;

    @Column(name = "note", length = 255)
    private String note;

    @Column(name = "updated_by_user_id")
    private Long updatedByUserId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public Long getId() {
        return id;
    }

    public String getProviderKey() {
        return providerKey;
    }

    public void setProviderKey(String providerKey) {
        this.providerKey = providerKey;
    }

    public String getActiveMode() {
        return activeMode;
    }

    public void setActiveMode(String activeMode) {
        this.activeMode = activeMode;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public Long getUpdatedByUserId() {
        return updatedByUserId;
    }

    public void setUpdatedByUserId(Long updatedByUserId) {
        this.updatedByUserId = updatedByUserId;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
