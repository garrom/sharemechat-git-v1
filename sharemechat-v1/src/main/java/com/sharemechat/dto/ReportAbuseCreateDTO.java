package com.sharemechat.dto;

public class ReportAbuseCreateDTO {
    private Long reportedUserId;
    private Long streamRecordId;      // opcional
    private String reportType;        // ABUSE, HARASSMENT, NUDITY, FRAUD, MINOR, OTHER...
    private String description;       // opcional
    private Boolean alsoBlock;        // opcional (default true en service)

    public Long getReportedUserId() { return reportedUserId; }
    public void setReportedUserId(Long reportedUserId) { this.reportedUserId = reportedUserId; }

    public Long getStreamRecordId() { return streamRecordId; }
    public void setStreamRecordId(Long streamRecordId) { this.streamRecordId = streamRecordId; }

    public String getReportType() { return reportType; }
    public void setReportType(String reportType) { this.reportType = reportType; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Boolean getAlsoBlock() { return alsoBlock; }
    public void setAlsoBlock(Boolean alsoBlock) { this.alsoBlock = alsoBlock; }
}