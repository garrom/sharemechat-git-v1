package com.sharemechat.support.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * ADR-054: ticket de incidencia. Dominio propio con lifecycle, evidencia
 * verificada contra fuentes internas y compensacion economica opcional
 * linkada a una Transaction (MANUAL_REFUND) via compensatedTransactionId.
 *
 * <p>La comunicacion con el cliente sobre el ticket va por una
 * SupportConversation asociada (linkedConversationId), reutilizando la
 * infra ADR-046. Las columnas linkedStreamRecordId y linkedPaymentSessionId
 * son hints opcionales del cliente sobre el objeto del incidente y
 * alimentan al TicketVerificationService.
 */
@Entity
@Table(name = "support_tickets")
public class SupportTicket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "category", nullable = false, length = 40)
    private String category;

    @Column(name = "status", nullable = false, length = 40)
    private String status;

    @Column(name = "description", nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(name = "reported_incident_at")
    private LocalDateTime reportedIncidentAt;

    @Column(name = "linked_conversation_id")
    private Long linkedConversationId;

    @Column(name = "linked_stream_record_id")
    private Long linkedStreamRecordId;

    @Column(name = "linked_payment_session_id")
    private Long linkedPaymentSessionId;

    @Column(name = "verification_last_run_at")
    private LocalDateTime verificationLastRunAt;

    @Column(name = "verification_last_result_json", columnDefinition = "JSON")
    private String verificationLastResultJson;

    @Column(name = "verification_last_signal", length = 20)
    private String verificationLastSignal;

    @Column(name = "compensated_amount_eur", precision = 10, scale = 2)
    private BigDecimal compensatedAmountEur;

    @Column(name = "compensated_transaction_id")
    private Long compensatedTransactionId;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "resolved_by_admin_id")
    private Long resolvedByAdminId;

    @Column(name = "resolution_notes", columnDefinition = "TEXT")
    private String resolutionNotes;

    @Column(name = "high_history_flag", nullable = false)
    private boolean highHistoryFlag;

    @Column(name = "created_at", nullable = false, updatable = false,
            columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false,
            columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    private LocalDateTime updatedAt;

    public SupportTicket() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        this.status = "OPEN";
        this.highHistoryFlag = false;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public LocalDateTime getReportedIncidentAt() { return reportedIncidentAt; }
    public void setReportedIncidentAt(LocalDateTime reportedIncidentAt) { this.reportedIncidentAt = reportedIncidentAt; }
    public Long getLinkedConversationId() { return linkedConversationId; }
    public void setLinkedConversationId(Long linkedConversationId) { this.linkedConversationId = linkedConversationId; }
    public Long getLinkedStreamRecordId() { return linkedStreamRecordId; }
    public void setLinkedStreamRecordId(Long linkedStreamRecordId) { this.linkedStreamRecordId = linkedStreamRecordId; }
    public Long getLinkedPaymentSessionId() { return linkedPaymentSessionId; }
    public void setLinkedPaymentSessionId(Long linkedPaymentSessionId) { this.linkedPaymentSessionId = linkedPaymentSessionId; }
    public LocalDateTime getVerificationLastRunAt() { return verificationLastRunAt; }
    public void setVerificationLastRunAt(LocalDateTime verificationLastRunAt) { this.verificationLastRunAt = verificationLastRunAt; }
    public String getVerificationLastResultJson() { return verificationLastResultJson; }
    public void setVerificationLastResultJson(String verificationLastResultJson) { this.verificationLastResultJson = verificationLastResultJson; }
    public String getVerificationLastSignal() { return verificationLastSignal; }
    public void setVerificationLastSignal(String verificationLastSignal) { this.verificationLastSignal = verificationLastSignal; }
    public BigDecimal getCompensatedAmountEur() { return compensatedAmountEur; }
    public void setCompensatedAmountEur(BigDecimal compensatedAmountEur) { this.compensatedAmountEur = compensatedAmountEur; }
    public Long getCompensatedTransactionId() { return compensatedTransactionId; }
    public void setCompensatedTransactionId(Long compensatedTransactionId) { this.compensatedTransactionId = compensatedTransactionId; }
    public LocalDateTime getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(LocalDateTime resolvedAt) { this.resolvedAt = resolvedAt; }
    public Long getResolvedByAdminId() { return resolvedByAdminId; }
    public void setResolvedByAdminId(Long resolvedByAdminId) { this.resolvedByAdminId = resolvedByAdminId; }
    public String getResolutionNotes() { return resolutionNotes; }
    public void setResolutionNotes(String resolutionNotes) { this.resolutionNotes = resolutionNotes; }
    public boolean isHighHistoryFlag() { return highHistoryFlag; }
    public void setHighHistoryFlag(boolean highHistoryFlag) { this.highHistoryFlag = highHistoryFlag; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
