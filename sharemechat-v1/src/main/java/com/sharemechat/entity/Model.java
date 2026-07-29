package com.sharemechat.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "models")
public class Model {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "profile_visits")
    private Integer profileVisits = 0;

    @Column(name = "streaming_hours")
    private BigDecimal streamingHours = BigDecimal.ZERO;

    @Column(name = "objetivo_ganancias")
    private BigDecimal objetivoGanancias  = BigDecimal.ZERO;

    @Column(name = "saldo_actual")
    private BigDecimal saldoActual  = BigDecimal.ZERO;

    @Column(name = "total_ingresos")
    private BigDecimal totalIngresos  = BigDecimal.ZERO;

    /**
     * ADR-037 frente trial-sfw Bloque 3: fecha/hora fin de ban de
     * streaming automatico. NULL o pasado = no baneada. Escrito por
     * {@code ModelBanService.emitBan}; leido por
     * {@code MatchingHandlerSupport.canMatch} como gate en caliente.
     * Solo afecta a streaming (matching random, calls); la modelo puede
     * seguir usando el resto de la app.
     */
    @Column(name = "streaming_banned_until")
    private LocalDateTime streamingBannedUntil;

    /**
     * ADR-056 (2026-07-29): FK al Master bajo cuyo umbrella opera esta
     * modelo. NULL = modelo individual (regimen INDIVIDUAL). NOT NULL =
     * modelo bajo Master (regimen MASTER, escalado agregado, STREAM_EARNING
     * al Master). Ver D1 y D4 del ADR-056. Sin @ManyToOne para evitar
     * dependencia ciclica con el modulo master/entity; se persiste como
     * Long y se resuelve via MasterRepository cuando hace falta.
     */
    @Column(name = "master_user_id")
    private Long masterUserId;

    // Relación uno a uno con User
    @OneToOne
    @MapsId
    @JoinColumn(name = "user_id")
    private User user;

    // Constructor sin argumentos requerido por JPA
    public Model() {
    }

    // Getters y Setters


    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public Integer getProfileVisits() {
        return profileVisits;
    }

    public void setProfileVisits(Integer profileVisits) {
        this.profileVisits = profileVisits;
    }


    public BigDecimal getStreamingHours() {
        return streamingHours;
    }

    public void setStreamingHours(BigDecimal streamingHours) {
        this.streamingHours = streamingHours;
    }

    public BigDecimal getObjetivoGanancias() {
        return objetivoGanancias;
    }

    public void setObjetivoGanancias(BigDecimal objetivoGanancias) {
        this.objetivoGanancias = objetivoGanancias;
    }

    public BigDecimal getSaldoActual() {
        return saldoActual;
    }

    public void setSaldoActual(BigDecimal saldoActual) {
        this.saldoActual = saldoActual;
    }

    public BigDecimal getTotalIngresos() {
        return totalIngresos;
    }

    public void setTotalIngresos(BigDecimal totalIngresos) {
        this.totalIngresos = totalIngresos;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public LocalDateTime getStreamingBannedUntil() {
        return streamingBannedUntil;
    }

    public void setStreamingBannedUntil(LocalDateTime streamingBannedUntil) {
        this.streamingBannedUntil = streamingBannedUntil;
    }

    public Long getMasterUserId() {
        return masterUserId;
    }

    public void setMasterUserId(Long masterUserId) {
        this.masterUserId = masterUserId;
    }
}
