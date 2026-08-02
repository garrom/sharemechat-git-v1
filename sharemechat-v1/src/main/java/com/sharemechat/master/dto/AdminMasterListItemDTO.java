package com.sharemechat.master.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * ADR-056 S7.a: fila de la tabla admin de Masters. Combina campos de
 * {@code masters} + {@code users}. Se ordena en frontend, aquí solo
 * data plana.
 */
public class AdminMasterListItemDTO {

    private Long userId;
    private String email;
    private String nickname;
    private String companyName;
    private String companyCountry;
    private boolean emailVerified;
    private String verificationStatus; // PENDING | APPROVED | REJECTED
    private boolean contractAccepted;
    private int totalModelsActive;
    private BigDecimal totalPaidOutEur;
    private BigDecimal balanceCurrent;
    private LocalDateTime onboardedAt;
    private LocalDateTime createdAt;
    // ADR-056 S7.b (2026-08-02): suspensión D11.
    private LocalDateTime suspendedAt;
    private String suspensionReason;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }

    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }

    public String getCompanyCountry() { return companyCountry; }
    public void setCompanyCountry(String companyCountry) { this.companyCountry = companyCountry; }

    public boolean isEmailVerified() { return emailVerified; }
    public void setEmailVerified(boolean emailVerified) { this.emailVerified = emailVerified; }

    public String getVerificationStatus() { return verificationStatus; }
    public void setVerificationStatus(String verificationStatus) { this.verificationStatus = verificationStatus; }

    public boolean isContractAccepted() { return contractAccepted; }
    public void setContractAccepted(boolean contractAccepted) { this.contractAccepted = contractAccepted; }

    public int getTotalModelsActive() { return totalModelsActive; }
    public void setTotalModelsActive(int totalModelsActive) { this.totalModelsActive = totalModelsActive; }

    public BigDecimal getTotalPaidOutEur() { return totalPaidOutEur; }
    public void setTotalPaidOutEur(BigDecimal totalPaidOutEur) { this.totalPaidOutEur = totalPaidOutEur; }

    public BigDecimal getBalanceCurrent() { return balanceCurrent; }
    public void setBalanceCurrent(BigDecimal balanceCurrent) { this.balanceCurrent = balanceCurrent; }

    public LocalDateTime getOnboardedAt() { return onboardedAt; }
    public void setOnboardedAt(LocalDateTime onboardedAt) { this.onboardedAt = onboardedAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getSuspendedAt() { return suspendedAt; }
    public void setSuspendedAt(LocalDateTime suspendedAt) { this.suspendedAt = suspendedAt; }

    public String getSuspensionReason() { return suspensionReason; }
    public void setSuspensionReason(String suspensionReason) { this.suspensionReason = suspensionReason; }
}
