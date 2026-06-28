package com.sharemechat.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Denuncia publica del canal Complaints workflow (V11). Distinta del
 * P2P interno ({@link ModerationReport}) que sigue para denuncias
 * entre usuarios autenticados.
 */
@Entity
@Table(name = "complaints")
public class Complaint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "reporter_email", length = 255)
    private String reporterEmail;

    @Column(name = "reporter_name", length = 255)
    private String reporterName;

    @Column(name = "reporter_ip_hash", length = 64)
    private String reporterIpHash;

    @Column(name = "category", nullable = false, length = 40)
    private String category;

    @Column(name = "description", nullable = false, length = 2000)
    private String description;

    @Column(name = "subject_email", length = 255)
    private String subjectEmail;

    @Column(name = "subject_url", length = 2000)
    private String subjectUrl;

    @Column(name = "subject_user_id")
    private Long subjectUserId;

    @Column(name = "subject_stream_record_id")
    private Long subjectStreamRecordId;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @Column(name = "channel", nullable = false, length = 20)
    private String channel;

    @Column(name = "created_at", nullable = false, updatable = false,
            columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt;

    @Column(name = "acknowledged_at")
    private LocalDateTime acknowledgedAt;

    @Column(name = "expected_resolution_at")
    private LocalDateTime expectedResolutionAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "sla_breach_at")
    private LocalDateTime slaBreachAt;

    @Column(name = "decision_code", length = 40)
    private String decisionCode;

    @Column(name = "decision_notes", length = 2000)
    private String decisionNotes;

    @Column(name = "reviewed_by_user_id")
    private Long reviewedByUserId;

    @Column(name = "related_moderation_report_id")
    private Long relatedModerationReportId;

    @Column(name = "related_stream_review_id")
    private Long relatedStreamReviewId;

    @Column(name = "updated_at", nullable = false,
            columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    private LocalDateTime updatedAt;

    public Complaint() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }

    public String getReporterEmail() { return reporterEmail; }
    public void setReporterEmail(String reporterEmail) { this.reporterEmail = reporterEmail; }

    public String getReporterName() { return reporterName; }
    public void setReporterName(String reporterName) { this.reporterName = reporterName; }

    public String getReporterIpHash() { return reporterIpHash; }
    public void setReporterIpHash(String reporterIpHash) { this.reporterIpHash = reporterIpHash; }

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
}
