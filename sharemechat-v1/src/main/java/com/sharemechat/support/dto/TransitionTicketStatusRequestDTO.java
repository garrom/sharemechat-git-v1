package com.sharemechat.support.dto;

/**
 * ADR-054 D6: input admin para cambiar el estado del ticket. La validez de la
 * transicion se enforca en {@code TicketService.isValidTransition}; aqui solo
 * transportamos payload. notes se guarda en resolution_notes cuando aplique.
 */
public class TransitionTicketStatusRequestDTO {

    private String newStatus;
    private String notes;

    public String getNewStatus() { return newStatus; }
    public void setNewStatus(String newStatus) { this.newStatus = newStatus; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
