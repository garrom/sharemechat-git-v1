package com.sharemechat.support.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "support_conversations")
public class SupportConversation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "started_at", nullable = false, updatable = false,
            columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime startedAt;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    @Column(name = "resolution_status", nullable = false, length = 20)
    private String resolutionStatus;

    @Column(name = "escalated_at")
    private LocalDateTime escalatedAt;

    @Column(name = "escalation_reason", length = 500)
    private String escalationReason;

    @Column(name = "escalated_by_llm", nullable = false)
    private boolean escalatedByLlm;

    @Column(name = "reporter_ip_hash", length = 64)
    private String reporterIpHash;

    @Column(name = "updated_at", nullable = false,
            columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    private LocalDateTime updatedAt;

    // Frente B.3.1 (ADR-046): asignacion humana. Los tres campos siguen la
    // invariante "todos NULL o todos NOT NULL" enforced por CHECK bi-columna
    // en BD (chk_support_conv_assign_bicolumn de V15).
    @Column(name = "assigned_agent_id")
    private Long assignedAgentId;

    @Column(name = "assigned_at")
    private LocalDateTime assignedAt;

    @Column(name = "assigned_profile_id")
    private Long assignedProfileId;

    public SupportConversation() {
        this.startedAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        this.escalatedByLlm = false;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }
    public LocalDateTime getEndedAt() { return endedAt; }
    public void setEndedAt(LocalDateTime endedAt) { this.endedAt = endedAt; }
    public String getResolutionStatus() { return resolutionStatus; }
    public void setResolutionStatus(String resolutionStatus) { this.resolutionStatus = resolutionStatus; }
    public LocalDateTime getEscalatedAt() { return escalatedAt; }
    public void setEscalatedAt(LocalDateTime escalatedAt) { this.escalatedAt = escalatedAt; }
    public String getEscalationReason() { return escalationReason; }
    public void setEscalationReason(String escalationReason) { this.escalationReason = escalationReason; }
    public boolean isEscalatedByLlm() { return escalatedByLlm; }
    public void setEscalatedByLlm(boolean escalatedByLlm) { this.escalatedByLlm = escalatedByLlm; }
    public String getReporterIpHash() { return reporterIpHash; }
    public void setReporterIpHash(String reporterIpHash) { this.reporterIpHash = reporterIpHash; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public Long getAssignedAgentId() { return assignedAgentId; }
    public void setAssignedAgentId(Long assignedAgentId) { this.assignedAgentId = assignedAgentId; }
    public LocalDateTime getAssignedAt() { return assignedAt; }
    public void setAssignedAt(LocalDateTime assignedAt) { this.assignedAt = assignedAt; }
    public Long getAssignedProfileId() { return assignedProfileId; }
    public void setAssignedProfileId(Long assignedProfileId) { this.assignedProfileId = assignedProfileId; }
}
