package com.sharemechat.dto;

import java.math.BigDecimal;

public class ModelDTO {

    private Long userId;
    private Integer profileVisits;
    private String referralCode;
    private BigDecimal referralEarnings;
    private BigDecimal streamingHours;
    private BigDecimal objetivoGanancias;
    private BigDecimal saldoActual;
    private BigDecimal totalIngresos;

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
}
