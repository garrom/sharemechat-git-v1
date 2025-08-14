package com.sharemechat.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;

@Entity
@Table(name = "models")
public class Model {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "profile_visits")
    private Integer profileVisits = 0;

    @Column(name = "referral_code")
    private String referralCode;

    @Column(name = "referral_earnings")
    private BigDecimal referralEarnings = BigDecimal.ZERO;

    @Column(name = "streaming_hours")
    private BigDecimal streamingHours = BigDecimal.ZERO;

    @Column(name = "objetivo_ganancias")
    private BigDecimal objetivoGanancias  = BigDecimal.ZERO;

    @Column(name = "saldo_actual")
    private BigDecimal saldoActual  = BigDecimal.ZERO;

    @Column(name = "total_ingresos")
    private BigDecimal totalIngresos  = BigDecimal.ZERO;

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

    public String getReferralCode() {
        return referralCode;
    }

    public void setReferralCode(String referralCode) {
        this.referralCode = referralCode;
    }

    public BigDecimal getReferralEarnings() {
        return referralEarnings;
    }

    public void setReferralEarnings(BigDecimal referralEarnings) {
        this.referralEarnings = referralEarnings;
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
}
