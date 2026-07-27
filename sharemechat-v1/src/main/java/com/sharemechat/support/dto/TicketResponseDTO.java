package com.sharemechat.support.dto;

import com.sharemechat.support.entity.SupportTicket;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * ADR-054: proyeccion externa de un {@link SupportTicket}. Expone campos
 * seguros para cliente + admin (mismo DTO, admin no requiere info extra
 * porque los campos internos como {@code resolvedByAdminId} ya son visibles).
 * La conversacion asociada y la Transaction compensada se navegan via los
 * ids linkados.
 */
public class TicketResponseDTO {

    private Long id;
    private Long userId;
    private String category;
    private String status;
    private String description;
    private LocalDateTime reportedIncidentAt;
    private Long linkedConversationId;
    private Long linkedStreamRecordId;
    private Long linkedPaymentSessionId;
    private LocalDateTime verificationLastRunAt;
    private String verificationLastSignal;
    private String verificationLastResultJson;
    private BigDecimal compensatedAmountEur;
    private Long compensatedTransactionId;
    private LocalDateTime resolvedAt;
    private Long resolvedByAdminId;
    private String resolutionNotes;
    private boolean highHistoryFlag;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static TicketResponseDTO from(SupportTicket t) {
        TicketResponseDTO d = new TicketResponseDTO();
        d.id = t.getId();
        d.userId = t.getUserId();
        d.category = t.getCategory();
        d.status = t.getStatus();
        d.description = t.getDescription();
        d.reportedIncidentAt = t.getReportedIncidentAt();
        d.linkedConversationId = t.getLinkedConversationId();
        d.linkedStreamRecordId = t.getLinkedStreamRecordId();
        d.linkedPaymentSessionId = t.getLinkedPaymentSessionId();
        d.verificationLastRunAt = t.getVerificationLastRunAt();
        d.verificationLastSignal = t.getVerificationLastSignal();
        d.verificationLastResultJson = t.getVerificationLastResultJson();
        d.compensatedAmountEur = t.getCompensatedAmountEur();
        d.compensatedTransactionId = t.getCompensatedTransactionId();
        d.resolvedAt = t.getResolvedAt();
        d.resolvedByAdminId = t.getResolvedByAdminId();
        d.resolutionNotes = t.getResolutionNotes();
        d.highHistoryFlag = t.isHighHistoryFlag();
        d.createdAt = t.getCreatedAt();
        d.updatedAt = t.getUpdatedAt();
        return d;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public String getCategory() { return category; }
    public String getStatus() { return status; }
    public String getDescription() { return description; }
    public LocalDateTime getReportedIncidentAt() { return reportedIncidentAt; }
    public Long getLinkedConversationId() { return linkedConversationId; }
    public Long getLinkedStreamRecordId() { return linkedStreamRecordId; }
    public Long getLinkedPaymentSessionId() { return linkedPaymentSessionId; }
    public LocalDateTime getVerificationLastRunAt() { return verificationLastRunAt; }
    public String getVerificationLastSignal() { return verificationLastSignal; }
    public String getVerificationLastResultJson() { return verificationLastResultJson; }
    public BigDecimal getCompensatedAmountEur() { return compensatedAmountEur; }
    public Long getCompensatedTransactionId() { return compensatedTransactionId; }
    public LocalDateTime getResolvedAt() { return resolvedAt; }
    public Long getResolvedByAdminId() { return resolvedByAdminId; }
    public String getResolutionNotes() { return resolutionNotes; }
    public boolean isHighHistoryFlag() { return highHistoryFlag; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
