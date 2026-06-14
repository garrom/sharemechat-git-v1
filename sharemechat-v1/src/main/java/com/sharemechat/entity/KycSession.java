package com.sharemechat.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "kyc_sessions",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_mks_provider_session", columnNames = {"provider", "provider_session_id"})
        }
)
public class KycSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "provider", nullable = false, length = 20)
    private String provider;

    // V9 (frente Didit cliente, 2026-06-14): distingue sesiones del MODELO
    // (Document+Selfie+Liveness) de las del CLIENTE (Age Estimation). En BD
    // la columna tiene NOT NULL DEFAULT 'MODEL'; las filas historicas que
    // existian antes de V9 quedaron como MODEL automaticamente. Valores
    // canonicos en {@link com.sharemechat.constants.Constants.SessionTypes}.
    @Column(name = "session_type", nullable = false, length = 10)
    private String sessionType;

    @Column(name = "provider_session_id", nullable = false, length = 100)
    private String providerSessionId;

    @Column(name = "provider_vendor_ref", length = 150)
    private String providerVendorRef;

    @Column(name = "provider_status", nullable = false, length = 30)
    private String providerStatus; // started/submitted/approved/declined/...

    @Column(name = "kyc_status", length = 20)
    private String kycStatus; // PENDING/APPROVED/REJECTED

    @Column(name = "provider_decision_code", length = 100)
    private String providerDecisionCode;

    @Column(name = "provider_decision_reason", length = 255)
    private String providerDecisionReason;

    @Column(name = "hosted_url", length = 500)
    private String hostedUrl;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    @Column(name = "last_webhook_at")
    private LocalDateTime lastWebhookAt;

    @Column(name = "last_provider_event_type", length = 100)
    private String lastProviderEventType;

    // V9: campos especificos del flujo CLIENTE (Age Estimation). NULL para
    // sesiones MODEL. Para sesiones CLIENT se rellenan al persistir el
    // webhook con la decision final de Didit Adaptive Age Verification.
    @Column(name = "estimated_age_decimal", precision = 5, scale = 2)
    private BigDecimal estimatedAgeDecimal;

    @Column(name = "confidence_score", precision = 5, scale = 2)
    private BigDecimal confidenceScore;

    @Column(name = "age_estimation_threshold")
    private Integer ageEstimationThreshold;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getProviderSessionId() {
        return providerSessionId;
    }

    public void setProviderSessionId(String providerSessionId) {
        this.providerSessionId = providerSessionId;
    }

    public String getProviderVendorRef() {
        return providerVendorRef;
    }

    public void setProviderVendorRef(String providerVendorRef) {
        this.providerVendorRef = providerVendorRef;
    }

    public String getProviderStatus() {
        return providerStatus;
    }

    public void setProviderStatus(String providerStatus) {
        this.providerStatus = providerStatus;
    }

    public String getKycStatus() {
        return kycStatus;
    }

    public void setKycStatus(String kycStatus) {
        this.kycStatus = kycStatus;
    }

    public String getProviderDecisionCode() {
        return providerDecisionCode;
    }

    public void setProviderDecisionCode(String providerDecisionCode) {
        this.providerDecisionCode = providerDecisionCode;
    }

    public String getProviderDecisionReason() {
        return providerDecisionReason;
    }

    public void setProviderDecisionReason(String providerDecisionReason) {
        this.providerDecisionReason = providerDecisionReason;
    }

    public String getHostedUrl() {
        return hostedUrl;
    }

    public void setHostedUrl(String hostedUrl) {
        this.hostedUrl = hostedUrl;
    }

    public LocalDateTime getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(LocalDateTime submittedAt) {
        this.submittedAt = submittedAt;
    }

    public LocalDateTime getDecidedAt() {
        return decidedAt;
    }

    public void setDecidedAt(LocalDateTime decidedAt) {
        this.decidedAt = decidedAt;
    }

    public LocalDateTime getLastWebhookAt() {
        return lastWebhookAt;
    }

    public void setLastWebhookAt(LocalDateTime lastWebhookAt) {
        this.lastWebhookAt = lastWebhookAt;
    }

    public String getLastProviderEventType() {
        return lastProviderEventType;
    }

    public void setLastProviderEventType(String lastProviderEventType) {
        this.lastProviderEventType = lastProviderEventType;
    }

    public String getSessionType() {
        return sessionType;
    }

    public void setSessionType(String sessionType) {
        this.sessionType = sessionType;
    }

    public BigDecimal getEstimatedAgeDecimal() {
        return estimatedAgeDecimal;
    }

    public void setEstimatedAgeDecimal(BigDecimal estimatedAgeDecimal) {
        this.estimatedAgeDecimal = estimatedAgeDecimal;
    }

    public BigDecimal getConfidenceScore() {
        return confidenceScore;
    }

    public void setConfidenceScore(BigDecimal confidenceScore) {
        this.confidenceScore = confidenceScore;
    }

    public Integer getAgeEstimationThreshold() {
        return ageEstimationThreshold;
    }

    public void setAgeEstimationThreshold(Integer ageEstimationThreshold) {
        this.ageEstimationThreshold = ageEstimationThreshold;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
