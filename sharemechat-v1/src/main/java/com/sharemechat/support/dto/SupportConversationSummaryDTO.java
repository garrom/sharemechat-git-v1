package com.sharemechat.support.dto;

import java.time.LocalDateTime;

/**
 * Fila del listado admin de conversaciones. Enriquecida con user email/role y
 * agent display_name via join en el service, no via FetchType.EAGER en la
 * entidad. Ver ADR-046.
 */
public class SupportConversationSummaryDTO {

    private Long id;
    private Long userId;
    private String userEmail;
    private String userRole;
    private String resolutionStatus;
    private boolean escalatedByLlm;
    private String escalationReason;
    private LocalDateTime escalatedAt;
    private Long assignedAgentId;
    private Long assignedProfileId;
    private String assignedProfileDisplayName;
    private LocalDateTime assignedAt;
    private long messageCount;
    private LocalDateTime lastMessageAt;
    private LocalDateTime startedAt;
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getUserEmail() { return userEmail; }
    public void setUserEmail(String userEmail) { this.userEmail = userEmail; }
    public String getUserRole() { return userRole; }
    public void setUserRole(String userRole) { this.userRole = userRole; }
    public String getResolutionStatus() { return resolutionStatus; }
    public void setResolutionStatus(String resolutionStatus) { this.resolutionStatus = resolutionStatus; }
    public boolean isEscalatedByLlm() { return escalatedByLlm; }
    public void setEscalatedByLlm(boolean escalatedByLlm) { this.escalatedByLlm = escalatedByLlm; }
    public String getEscalationReason() { return escalationReason; }
    public void setEscalationReason(String escalationReason) { this.escalationReason = escalationReason; }
    public LocalDateTime getEscalatedAt() { return escalatedAt; }
    public void setEscalatedAt(LocalDateTime escalatedAt) { this.escalatedAt = escalatedAt; }
    public Long getAssignedAgentId() { return assignedAgentId; }
    public void setAssignedAgentId(Long assignedAgentId) { this.assignedAgentId = assignedAgentId; }
    public Long getAssignedProfileId() { return assignedProfileId; }
    public void setAssignedProfileId(Long assignedProfileId) { this.assignedProfileId = assignedProfileId; }
    public String getAssignedProfileDisplayName() { return assignedProfileDisplayName; }
    public void setAssignedProfileDisplayName(String assignedProfileDisplayName) { this.assignedProfileDisplayName = assignedProfileDisplayName; }
    public LocalDateTime getAssignedAt() { return assignedAt; }
    public void setAssignedAt(LocalDateTime assignedAt) { this.assignedAt = assignedAt; }
    public long getMessageCount() { return messageCount; }
    public void setMessageCount(long messageCount) { this.messageCount = messageCount; }
    public LocalDateTime getLastMessageAt() { return lastMessageAt; }
    public void setLastMessageAt(LocalDateTime lastMessageAt) { this.lastMessageAt = lastMessageAt; }
    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
