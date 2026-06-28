package com.sharemechat.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Vista plana de una complaint para panel admin. Incluye campos
 * derivados {@code slaState} ({@code OK}, {@code NEAR}, {@code BREACH})
 * calculado por {@code ComplaintService} en base a
 * {@code expected_resolution_at} vs {@code LocalDateTime.now()}, y la
 * lista de eventos {@code auditLog} cuando el admin pide el detalle.
 *
 * <p>Para la lista (queue) se omite {@code auditLog}; para el detalle
 * se incluye.
 */
public class ComplaintDTO {

    private Long id;
    private String reporterEmail;        // null si anonimo
    private String reporterName;
    private String category;
    private String description;
    private String subjectEmail;
    private String subjectUrl;
    private Long subjectUserId;
    private Long subjectStreamRecordId;
    private String status;
    private String channel;
    private LocalDateTime createdAt;
    private LocalDateTime acknowledgedAt;
    private LocalDateTime expectedResolutionAt;
    private LocalDateTime resolvedAt;
    private LocalDateTime slaBreachAt;
    private String decisionCode;
    private String decisionNotes;
    private Long reviewedByUserId;
    private Long relatedModerationReportId;
    private Long relatedStreamReviewId;
    private LocalDateTime updatedAt;

    // Derivados: OK | NEAR (<24h to expected) | BREACH (>= expected and not resolved)
    private String slaState;
    private List<ComplaintAuditLogDTO> auditLog;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getReporterEmail() { return reporterEmail; }
    public void setReporterEmail(String reporterEmail) { this.reporterEmail = reporterEmail; }

    public String getReporterName() { return reporterName; }
    public void setReporterName(String reporterName) { this.reporterName = reporterName; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getSubjectEmail() { return subjectEmail; }
    public void setSubjectEmail(String subjectEmail) { this.subjectEmail = subjectEmail; }

    public String getSubjectUrl() { return subjectUrl; }
    public void setSubjectUrl(String subjectUrl) { this.subjectUrl = subjectUrl; }

    public Long getSubjectUserId() { return subjectUserId; }
    public void setSubjectUserId(Long subjectUserId) { this.subjectUserId = subjectUserId; }

    public Long getSubjectStreamRecordId() { return subjectStreamRecordId; }
    public void setSubjectStreamRecordId(Long subjectStreamRecordId) { this.subjectStreamRecordId = subjectStreamRecordId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getChannel() { return channel; }
    public void setChannel(String channel) { this.channel = channel; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getAcknowledgedAt() { return acknowledgedAt; }
    public void setAcknowledgedAt(LocalDateTime acknowledgedAt) { this.acknowledgedAt = acknowledgedAt; }

    public LocalDateTime getExpectedResolutionAt() { return expectedResolutionAt; }
    public void setExpectedResolutionAt(LocalDateTime expectedResolutionAt) { this.expectedResolutionAt = expectedResolutionAt; }

    public LocalDateTime getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(LocalDateTime resolvedAt) { this.resolvedAt = resolvedAt; }

    public LocalDateTime getSlaBreachAt() { return slaBreachAt; }
    public void setSlaBreachAt(LocalDateTime slaBreachAt) { this.slaBreachAt = slaBreachAt; }

    public String getDecisionCode() { return decisionCode; }
    public void setDecisionCode(String decisionCode) { this.decisionCode = decisionCode; }

    public String getDecisionNotes() { return decisionNotes; }
    public void setDecisionNotes(String decisionNotes) { this.decisionNotes = decisionNotes; }

    public Long getReviewedByUserId() { return reviewedByUserId; }
    public void setReviewedByUserId(Long reviewedByUserId) { this.reviewedByUserId = reviewedByUserId; }

    public Long getRelatedModerationReportId() { return relatedModerationReportId; }
    public void setRelatedModerationReportId(Long relatedModerationReportId) { this.relatedModerationReportId = relatedModerationReportId; }

    public Long getRelatedStreamReviewId() { return relatedStreamReviewId; }
    public void setRelatedStreamReviewId(Long relatedStreamReviewId) { this.relatedStreamReviewId = relatedStreamReviewId; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public String getSlaState() { return slaState; }
    public void setSlaState(String slaState) { this.slaState = slaState; }

    public List<ComplaintAuditLogDTO> getAuditLog() { return auditLog; }
    public void setAuditLog(List<ComplaintAuditLogDTO> auditLog) { this.auditLog = auditLog; }
}
