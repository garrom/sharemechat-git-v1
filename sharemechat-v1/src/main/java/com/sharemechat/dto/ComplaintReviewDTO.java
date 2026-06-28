package com.sharemechat.dto;

/**
 * Input del endpoint {@code POST /api/admin/complaints/{id}/review}.
 * {@code newStatus} obligatorio (set {@link com.sharemechat.constants.Constants.ComplaintStatuses}).
 * {@code decisionCode} opcional (obligatorio si {@code newStatus} es
 * {@code RESOLVED} o {@code REJECTED}; validado en service).
 */
public class ComplaintReviewDTO {

    private String newStatus;
    private String decisionCode;
    private String notes;

    public String getNewStatus() { return newStatus; }
    public void setNewStatus(String newStatus) { this.newStatus = newStatus; }

    public String getDecisionCode() { return decisionCode; }
    public void setDecisionCode(String decisionCode) { this.decisionCode = decisionCode; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
