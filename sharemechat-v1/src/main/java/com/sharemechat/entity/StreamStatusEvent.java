package com.sharemechat.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "stream_status_events")
public class StreamStatusEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "stream_record_id", nullable = false)
    private Long streamRecordId;

    @Column(name = "event_type", nullable = false, length = 40)
    private String eventType;

    @Column(name = "reason", length = 100)
    private String reason;

    @Column(name = "metadata", columnDefinition = "json")
    private String metadata;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public StreamStatusEvent() {
    }

    public Long getId() {
        return id;
    }

    public Long getStreamRecordId() {
        return streamRecordId;
    }

    public void setStreamRecordId(Long streamRecordId) {
        this.streamRecordId = streamRecordId;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getMetadata() {
        return metadata;
    }

    public void setMetadata(String metadata) {
        this.metadata = metadata;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
