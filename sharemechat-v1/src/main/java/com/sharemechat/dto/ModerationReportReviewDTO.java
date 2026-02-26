package com.sharemechat.dto;

public class ModerationReportReviewDTO {
    private String status;          // REVIEWING, RESOLVED, REJECTED
    private String adminAction;     // NONE, WARNING, SUSPEND, BAN
    private String resolutionNotes; // opcional

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getAdminAction() { return adminAction; }
    public void setAdminAction(String adminAction) { this.adminAction = adminAction; }

    public String getResolutionNotes() { return resolutionNotes; }
    public void setResolutionNotes(String resolutionNotes) { this.resolutionNotes = resolutionNotes; }
}