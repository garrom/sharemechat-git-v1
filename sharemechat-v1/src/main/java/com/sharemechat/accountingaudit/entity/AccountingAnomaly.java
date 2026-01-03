package com.sharemechat.accountingaudit.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "accounting_anomalies")
public class AccountingAnomaly {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String anomalyType;
    private String severity;
    private Long userId;
    private Long streamRecordId;
    private Long transactionId;
    private Instant detectedAt;
    private BigDecimal expectedValue;
    private BigDecimal actualValue;
    private BigDecimal deltaValue;

    @Column(name = "platform_transaction_id")
    private Long platformTransactionId;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String description;

    private String status;
    private Instant resolvedAt;

    @Column(columnDefinition = "TEXT")
    private String resolutionNote;

    @Column(name = "audit_run_id", nullable = false)
    private String auditRunId;

    private Instant createdAt;

    // getters / setters


    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getAnomalyType() {
        return anomalyType;
    }

    public void setAnomalyType(String anomalyType) {
        this.anomalyType = anomalyType;
    }

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public Long getStreamRecordId() {
        return streamRecordId;
    }

    public void setStreamRecordId(Long streamRecordId) {
        this.streamRecordId = streamRecordId;
    }

    public Long getTransactionId() {
        return transactionId;
    }

    public void setTransactionId(Long transactionId) {
        this.transactionId = transactionId;
    }

    public Instant getDetectedAt() {
        return detectedAt;
    }

    public void setDetectedAt(Instant detectedAt) {
        this.detectedAt = detectedAt;
    }

    public BigDecimal getExpectedValue() {
        return expectedValue;
    }

    public void setExpectedValue(BigDecimal expectedValue) {
        this.expectedValue = expectedValue;
    }

    public BigDecimal getActualValue() {
        return actualValue;
    }

    public void setActualValue(BigDecimal actualValue) {
        this.actualValue = actualValue;
    }

    public BigDecimal getDeltaValue() {
        return deltaValue;
    }

    public void setDeltaValue(BigDecimal deltaValue) {
        this.deltaValue = deltaValue;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Instant getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(Instant resolvedAt) {
        this.resolvedAt = resolvedAt;
    }

    public String getResolutionNote() {
        return resolutionNote;
    }

    public void setResolutionNote(String resolutionNote) {
        this.resolutionNote = resolutionNote;
    }

    public String getAuditRunId() {
        return auditRunId;
    }

    public void setAuditRunId(String auditRunId) {
        this.auditRunId = auditRunId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Long getPlatformTransactionId() {
        return platformTransactionId;
    }

    public void setPlatformTransactionId(Long platformTransactionId) {
        this.platformTransactionId = platformTransactionId;
    }
}
