package com.sharemechat.streammoderation.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Fila de cola humana de moderacion sobre un verdict del proveedor
 * (ADR-030 control plane propio + cola humana). Calca el patron
 * {@code ModelAssetReview} (cola con motivo + decision_code +
 * decision_note + reviewer_id) y lo extiende con
 * {@code category / severity / score / priority} propios del frente
 * de moderacion visual.
 *
 * <p>Estados (canonicos en
 * {@link com.sharemechat.constants.Constants.StreamModerationReviewStatus}):
 * PENDING, IN_REVIEW, APPROVED, REJECTED, CANCELLED.
 *
 * <p>{@code provider} se denormaliza para que la UK
 * (provider, provider_event_id) pueda imponerse sin JOIN a
 * {@code stream_moderation_events}.
 *
 * <p>Patron vendor-agnostic: clases, columnas y endpoints son agnostic;
 * el nombre del vendor solo aparece como valor literal en
 * {@code provider}. Ver ADR-036, ADR-037.
 */
@Entity
@Table(
        name = "stream_moderation_reviews",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_stream_moderation_reviews_provider_event",
                        columnNames = {"provider", "provider_event_id"}
                )
        }
)
public class StreamModerationReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "stream_record_id", nullable = false)
    private Long streamRecordId;

    @Column(name = "stream_moderation_session_id", nullable = false)
    private Long streamModerationSessionId;

    @Column(name = "provider", nullable = false, length = 20)
    private String provider;

    @Column(name = "category", nullable = false, length = 40)
    private String category;

    @Column(name = "severity", nullable = false, length = 10)
    private String severity;

    @Column(name = "score", nullable = false, precision = 5, scale = 2)
    private BigDecimal score;

    @Column(name = "provider_event_id", length = 150)
    private String providerEventId;

    @Column(name = "evidence_ref", length = 255)
    private String evidenceRef;

    @Column(name = "frame_timestamp")
    private LocalDateTime frameTimestamp;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "PENDING";

    @Column(name = "priority", nullable = false)
    private int priority = 100;

    @Column(name = "reviewer_id")
    private Long reviewerId;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "decision_code", length = 50)
    private String decisionCode;

    @Column(name = "decision_note", length = 500)
    private String decisionNote;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public Long getId() {
        return id;
    }

    public Long getStreamRecordId() {
        return streamRecordId;
    }

    public void setStreamRecordId(Long streamRecordId) {
        this.streamRecordId = streamRecordId;
    }

    public Long getStreamModerationSessionId() {
        return streamModerationSessionId;
    }

    public void setStreamModerationSessionId(Long streamModerationSessionId) {
        this.streamModerationSessionId = streamModerationSessionId;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }

    public BigDecimal getScore() {
        return score;
    }

    public void setScore(BigDecimal score) {
        this.score = score;
    }

    public String getProviderEventId() {
        return providerEventId;
    }

    public void setProviderEventId(String providerEventId) {
        this.providerEventId = providerEventId;
    }

    public String getEvidenceRef() {
        return evidenceRef;
    }

    public void setEvidenceRef(String evidenceRef) {
        this.evidenceRef = evidenceRef;
    }

    public LocalDateTime getFrameTimestamp() {
        return frameTimestamp;
    }

    public void setFrameTimestamp(LocalDateTime frameTimestamp) {
        this.frameTimestamp = frameTimestamp;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public int getPriority() {
        return priority;
    }

    public void setPriority(int priority) {
        this.priority = priority;
    }

    public Long getReviewerId() {
        return reviewerId;
    }

    public void setReviewerId(Long reviewerId) {
        this.reviewerId = reviewerId;
    }

    public LocalDateTime getReviewedAt() {
        return reviewedAt;
    }

    public void setReviewedAt(LocalDateTime reviewedAt) {
        this.reviewedAt = reviewedAt;
    }

    public String getDecisionCode() {
        return decisionCode;
    }

    public void setDecisionCode(String decisionCode) {
        this.decisionCode = decisionCode;
    }

    public String getDecisionNote() {
        return decisionNote;
    }

    public void setDecisionNote(String decisionNote) {
        this.decisionNote = decisionNote;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
