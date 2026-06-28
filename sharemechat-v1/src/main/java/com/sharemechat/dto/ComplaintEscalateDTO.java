package com.sharemechat.dto;

/**
 * Input del endpoint {@code POST /api/admin/complaints/{id}/escalate}.
 * Forzar transicion a {@code ESCALATED} con nota explicativa.
 */
public class ComplaintEscalateDTO {

    private String notes;

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
