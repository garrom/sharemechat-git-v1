package com.sharemechat.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "stream_records")
public class StreamRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // FK: users.id (cliente)
    @ManyToOne
    @JoinColumn(name = "client_id", nullable = false)
    private User client;

    // FK: users.id (modelo)
    @ManyToOne
    @JoinColumn(name = "model_id", nullable = false)
    private User model;

    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    @Column(name = "end_time")
    private LocalDateTime endTime;

    @Column(name = "timestamp", insertable = false, updatable = false)
    private LocalDateTime timestamp;

    public StreamRecord() {}

    // getters and setters

    public Long getId() { return id; }

    public User getClient() { return client; }
    public void setClient(User client) { this.client = client; }

    public User getModel() { return model; }
    public void setModel(User model) { this.model = model; }

    public LocalDateTime getStartTime() { return startTime; }
    public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }

    public LocalDateTime getConfirmedAt() { return confirmedAt; }
    public void setConfirmedAt(LocalDateTime confirmedAt) { this.confirmedAt = confirmedAt; }

    public LocalDateTime getEndTime() { return endTime; }
    public void setEndTime(LocalDateTime endTime) { this.endTime = endTime; }

    public LocalDateTime getTimestamp() { return timestamp; }
}
