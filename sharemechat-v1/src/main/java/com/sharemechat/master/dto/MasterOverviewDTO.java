package com.sharemechat.master.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * ADR-056 S5.a.2: KPIs consolidados del Master para el dashboard Overview.
 * <p>
 * Los ingresos son un display consolidado — NO determinan tramo. Tras la
 * revisión D4 (2026-07-30) el motor calcula el % per modelo (individual);
 * el Master recibe la suma de los pagos individuales.
 */
public class MasterOverviewDTO {

    private BigDecimal billedGrossEur30d;
    private Integer activeModelsCount;
    private Integer pendingModelsCount;
    private BigDecimal balanceCurrent;
    private LocalDateTime lastPayoutAt;
    private BigDecimal lastPayoutAmount;
    private String verificationStatus;
    private Boolean emailVerified;
    private Boolean contractAccepted;

    public BigDecimal getBilledGrossEur30d() { return billedGrossEur30d; }
    public void setBilledGrossEur30d(BigDecimal billedGrossEur30d) { this.billedGrossEur30d = billedGrossEur30d; }

    public Integer getActiveModelsCount() { return activeModelsCount; }
    public void setActiveModelsCount(Integer activeModelsCount) { this.activeModelsCount = activeModelsCount; }

    public Integer getPendingModelsCount() { return pendingModelsCount; }
    public void setPendingModelsCount(Integer pendingModelsCount) { this.pendingModelsCount = pendingModelsCount; }

    public BigDecimal getBalanceCurrent() { return balanceCurrent; }
    public void setBalanceCurrent(BigDecimal balanceCurrent) { this.balanceCurrent = balanceCurrent; }

    public LocalDateTime getLastPayoutAt() { return lastPayoutAt; }
    public void setLastPayoutAt(LocalDateTime lastPayoutAt) { this.lastPayoutAt = lastPayoutAt; }

    public BigDecimal getLastPayoutAmount() { return lastPayoutAmount; }
    public void setLastPayoutAmount(BigDecimal lastPayoutAmount) { this.lastPayoutAmount = lastPayoutAmount; }

    public String getVerificationStatus() { return verificationStatus; }
    public void setVerificationStatus(String verificationStatus) { this.verificationStatus = verificationStatus; }

    public Boolean getEmailVerified() { return emailVerified; }
    public void setEmailVerified(Boolean emailVerified) { this.emailVerified = emailVerified; }

    public Boolean getContractAccepted() { return contractAccepted; }
    public void setContractAccepted(Boolean contractAccepted) { this.contractAccepted = contractAccepted; }
}
