package com.sharemechat.support.dto;

import java.time.LocalDateTime;

/**
 * ADR-054 D2 b1: input del formulario cliente para abrir un ticket.
 * category validada contra {@code TicketService.VALID_CATEGORIES} + description
 * obligatoria; el resto son opcionales que alimentan la verificacion automatica
 * cuando el cliente sabe qué stream o pago reclama.
 */
public class OpenTicketRequestDTO {

    private String category;
    private String description;
    private LocalDateTime reportedIncidentAt;
    private Long linkedStreamRecordId;
    private Long linkedPaymentSessionId;

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public LocalDateTime getReportedIncidentAt() { return reportedIncidentAt; }
    public void setReportedIncidentAt(LocalDateTime reportedIncidentAt) {
        this.reportedIncidentAt = reportedIncidentAt;
    }

    public Long getLinkedStreamRecordId() { return linkedStreamRecordId; }
    public void setLinkedStreamRecordId(Long linkedStreamRecordId) {
        this.linkedStreamRecordId = linkedStreamRecordId;
    }

    public Long getLinkedPaymentSessionId() { return linkedPaymentSessionId; }
    public void setLinkedPaymentSessionId(Long linkedPaymentSessionId) {
        this.linkedPaymentSessionId = linkedPaymentSessionId;
    }
}
