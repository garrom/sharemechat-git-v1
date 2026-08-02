package com.sharemechat.master.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * ADR-056: entidad Master (estudio de webcam). Persona fisica que gestiona
 * modelos bajo su umbrella. Relacion 1-a-1 con {@code users} vía user_id
 * (patron simetrico a Model y Client). No streamea (D en ADR-056).
 *
 * <p>Los campos {@code company_*} son opcionales — solo aplican si el
 * Master representa a una empresa. KYC siempre a persona fisica (D6).
 */
@Entity
@Table(name = "masters")
public class Master {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "company_name", length = 200)
    private String companyName;

    @Column(name = "company_registration_number", length = 100)
    private String companyRegistrationNumber;

    @Column(name = "company_country", length = 2)
    private String companyCountry;

    @Column(name = "total_models_active", nullable = false)
    private Integer totalModelsActive = 0;

    @Column(name = "total_paid_out_eur", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalPaidOutEur = BigDecimal.ZERO;

    @Column(name = "onboarded_at")
    private LocalDateTime onboardedAt;

    /**
     * ADR-056 S7.b (2026-08-02): suspensión D11. NULL = operativo. Cuando
     * está seteado, el {@code MasterSuspendedFilter} bloquea POST/PATCH/
     * DELETE sensibles bajo /api/masters/me/**. Las modelos bajo umbrella
     * se liberaron a INDIVIDUAL en el momento de suspender (transaccional).
     */
    @Column(name = "suspended_at")
    private LocalDateTime suspendedAt;

    @Column(name = "suspended_by_user_id")
    private Long suspendedByUserId;

    @Column(name = "suspension_reason", length = 500)
    private String suspensionReason;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public Master() {}

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }

    public String getCompanyRegistrationNumber() { return companyRegistrationNumber; }
    public void setCompanyRegistrationNumber(String companyRegistrationNumber) { this.companyRegistrationNumber = companyRegistrationNumber; }

    public String getCompanyCountry() { return companyCountry; }
    public void setCompanyCountry(String companyCountry) { this.companyCountry = companyCountry; }

    public Integer getTotalModelsActive() { return totalModelsActive; }
    public void setTotalModelsActive(Integer totalModelsActive) { this.totalModelsActive = totalModelsActive; }

    public BigDecimal getTotalPaidOutEur() { return totalPaidOutEur; }
    public void setTotalPaidOutEur(BigDecimal totalPaidOutEur) { this.totalPaidOutEur = totalPaidOutEur; }

    public LocalDateTime getOnboardedAt() { return onboardedAt; }
    public void setOnboardedAt(LocalDateTime onboardedAt) { this.onboardedAt = onboardedAt; }

    public LocalDateTime getSuspendedAt() { return suspendedAt; }
    public void setSuspendedAt(LocalDateTime suspendedAt) { this.suspendedAt = suspendedAt; }

    public Long getSuspendedByUserId() { return suspendedByUserId; }
    public void setSuspendedByUserId(Long suspendedByUserId) { this.suspendedByUserId = suspendedByUserId; }

    public String getSuspensionReason() { return suspensionReason; }
    public void setSuspensionReason(String suspensionReason) { this.suspensionReason = suspensionReason; }

    public boolean isSuspended() { return suspendedAt != null; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
