package com.sharemechat.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Capa B de atribucion de origen (ADR-057). Fila 1:1 con {@link User} que
 * guarda la fuente first-touch (utm + referrer + landing) del usuario en el
 * momento del registro.
 *
 * Diseno deliberado: PK manual (user_id = id del User ya guardado), SIN
 * {@code @OneToOne @MapsId}, para evitar el {@code StaleObjectStateException}
 * que dio problemas en el frente Master (se setea el id a mano tras el save
 * del User, en transaccion aparte y despues del commit del alta).
 *
 * Dataset minimo defendible: solo datos de canal de marketing, sin PII directa
 * (la IP de registro vive en users.regist_ip y el pais en
 * users.country_detected). Los valores los aporta el frontend (auto-declarados
 * por el cliente).
 */
@Entity
@Table(name = "user_acquisition")
public class UserAcquisition {

    /** PK = FK a users(id). Se asigna manualmente tras guardar el User. */
    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "utm_source")
    private String utmSource;

    @Column(name = "utm_medium")
    private String utmMedium;

    @Column(name = "utm_campaign")
    private String utmCampaign;

    @Column(name = "referrer_host")
    private String referrerHost;

    @Column(name = "landing_path")
    private String landingPath;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getUtmSource() {
        return utmSource;
    }

    public void setUtmSource(String utmSource) {
        this.utmSource = utmSource;
    }

    public String getUtmMedium() {
        return utmMedium;
    }

    public void setUtmMedium(String utmMedium) {
        this.utmMedium = utmMedium;
    }

    public String getUtmCampaign() {
        return utmCampaign;
    }

    public void setUtmCampaign(String utmCampaign) {
        this.utmCampaign = utmCampaign;
    }

    public String getReferrerHost() {
        return referrerHost;
    }

    public void setReferrerHost(String referrerHost) {
        this.referrerHost = referrerHost;
    }

    public String getLandingPath() {
        return landingPath;
    }

    public void setLandingPath(String landingPath) {
        this.landingPath = landingPath;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
