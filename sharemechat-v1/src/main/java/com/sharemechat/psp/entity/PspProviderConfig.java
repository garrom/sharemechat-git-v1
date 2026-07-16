package com.sharemechat.psp.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * ADR-051 D8: kill-switch runtime editable del PSP activo. Calcado de
 * {@link com.sharemechat.entity.KycProviderConfig} (2026-06-13, ADR-035).
 *
 * <p>Un fila por vendor ({@code provider_key} UNIQUE). Doble kill-switch
 * (D8): (1) property {@code psp.<vendor>.enabled} activada por deploy;
 * (2) esta tabla {@code active_mode} editable en runtime desde el panel
 * admin sin redeploy. Ambas condiciones deben ser TRUE/ENABLED para que
 * el vendor procese checkouts. Cualquiera OFF → 503 PSP_UNAVAILABLE.
 *
 * <p>Migración baseline: {@code V28__psp_provider_config.sql}. Fila
 * seed inicial: {@code (nowpayments, DISABLED, 1, "seed inicial ADR-051")}.
 */
@Entity
@Table(name = "psp_provider_config")
public class PspProviderConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "provider_key", nullable = false, length = 50, unique = true)
    private String providerKey; // 'nowpayments' | 'vendo' | 'commercegate' | ...

    @Column(name = "active_mode", nullable = false, length = 20)
    private String activeMode; // 'ENABLED' | 'DISABLED'

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

    public Long getId() { return id; }

    public String getProviderKey() { return providerKey; }
    public void setProviderKey(String providerKey) { this.providerKey = providerKey; }

    public String getActiveMode() { return activeMode; }
    public void setActiveMode(String activeMode) { this.activeMode = activeMode; }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public Long getUpdatedByUserId() { return updatedByUserId; }
    public void setUpdatedByUserId(Long updatedByUserId) { this.updatedByUserId = updatedByUserId; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
