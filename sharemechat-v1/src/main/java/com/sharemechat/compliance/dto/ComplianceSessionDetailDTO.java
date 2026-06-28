package com.sharemechat.compliance.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Vista B: drill-down de una sesion concreta. Metadata + timeline de
 * frames + reviews emitidas durante la sesion. El payload_json crudo se
 * pide en endpoint aparte (lazy on-click).
 */
public class ComplianceSessionDetailDTO {

    public static class FrameEntry {
        private Long eventId;
        private String providerEventId;
        private String eventType;
        private Boolean isProcessed;
        private LocalDateTime receivedAt;
        private LocalDateTime processedAt;

        public Long getEventId() { return eventId; }
        public void setEventId(Long eventId) { this.eventId = eventId; }
        public String getProviderEventId() { return providerEventId; }
        public void setProviderEventId(String providerEventId) { this.providerEventId = providerEventId; }
        public String getEventType() { return eventType; }
        public void setEventType(String eventType) { this.eventType = eventType; }
        public Boolean getIsProcessed() { return isProcessed; }
        public void setIsProcessed(Boolean isProcessed) { this.isProcessed = isProcessed; }
        public LocalDateTime getReceivedAt() { return receivedAt; }
        public void setReceivedAt(LocalDateTime receivedAt) { this.receivedAt = receivedAt; }
        public LocalDateTime getProcessedAt() { return processedAt; }
        public void setProcessedAt(LocalDateTime processedAt) { this.processedAt = processedAt; }
    }

    public static class ReviewEntry {
        private Long reviewId;
        private String category;
        private String severity;
        private Double score;
        private String status;
        private String evidenceRef;
        private LocalDateTime createdAt;
        private LocalDateTime reviewedAt;
        private String decisionCode;

        public Long getReviewId() { return reviewId; }
        public void setReviewId(Long reviewId) { this.reviewId = reviewId; }
        public String getCategory() { return category; }
        public void setCategory(String category) { this.category = category; }
        public String getSeverity() { return severity; }
        public void setSeverity(String severity) { this.severity = severity; }
        public Double getScore() { return score; }
        public void setScore(Double score) { this.score = score; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public String getEvidenceRef() { return evidenceRef; }
        public void setEvidenceRef(String evidenceRef) { this.evidenceRef = evidenceRef; }
        public LocalDateTime getCreatedAt() { return createdAt; }
        public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
        public LocalDateTime getReviewedAt() { return reviewedAt; }
        public void setReviewedAt(LocalDateTime reviewedAt) { this.reviewedAt = reviewedAt; }
        public String getDecisionCode() { return decisionCode; }
        public void setDecisionCode(String decisionCode) { this.decisionCode = decisionCode; }
    }

    private Long sessionId;
    private Long streamRecordId;
    private String provider;
    private String providerSessionId;
    private Integer samplingCadenceSeconds;
    private String samplingStrategy;
    private String status;
    private LocalDateTime startedAt;
    private LocalDateTime stoppedAt;
    private Integer framesSubmitted;
    private Integer verdictsReceived;
    private LocalDateTime degradedSince;
    private List<FrameEntry> frames;
    private List<ReviewEntry> reviews;

    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public Long getStreamRecordId() { return streamRecordId; }
    public void setStreamRecordId(Long streamRecordId) { this.streamRecordId = streamRecordId; }
    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public String getProviderSessionId() { return providerSessionId; }
    public void setProviderSessionId(String providerSessionId) { this.providerSessionId = providerSessionId; }
    public Integer getSamplingCadenceSeconds() { return samplingCadenceSeconds; }
    public void setSamplingCadenceSeconds(Integer samplingCadenceSeconds) { this.samplingCadenceSeconds = samplingCadenceSeconds; }
    public String getSamplingStrategy() { return samplingStrategy; }
    public void setSamplingStrategy(String samplingStrategy) { this.samplingStrategy = samplingStrategy; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }
    public LocalDateTime getStoppedAt() { return stoppedAt; }
    public void setStoppedAt(LocalDateTime stoppedAt) { this.stoppedAt = stoppedAt; }
    public Integer getFramesSubmitted() { return framesSubmitted; }
    public void setFramesSubmitted(Integer framesSubmitted) { this.framesSubmitted = framesSubmitted; }
    public Integer getVerdictsReceived() { return verdictsReceived; }
    public void setVerdictsReceived(Integer verdictsReceived) { this.verdictsReceived = verdictsReceived; }
    public LocalDateTime getDegradedSince() { return degradedSince; }
    public void setDegradedSince(LocalDateTime degradedSince) { this.degradedSince = degradedSince; }
    public List<FrameEntry> getFrames() { return frames; }
    public void setFrames(List<FrameEntry> frames) { this.frames = frames; }
    public List<ReviewEntry> getReviews() { return reviews; }
    public void setReviews(List<ReviewEntry> reviews) { this.reviews = reviews; }
}
