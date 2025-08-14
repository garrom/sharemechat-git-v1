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

    @Column(name = "end_time")
    private LocalDateTime endTime;

    @Column(name = "is_premium", nullable = false)
    private Boolean isPremium;

    @Column(name = "timestamp", insertable = false, updatable = false)
    private LocalDateTime timestamp;

    public StreamRecord() {}

    public Long getId() { return id; }

    public User getClient() { return client; }
    public void setClient(User client) { this.client = client; }

    public User getModel() { return model; }
    public void setModel(User model) { this.model = model; }

    public LocalDateTime getStartTime() { return startTime; }
    public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }

    public LocalDateTime getEndTime() { return endTime; }
    public void setEndTime(LocalDateTime endTime) { this.endTime = endTime; }

    public Boolean getIsPremium() { return isPremium; }
    public void setIsPremium(Boolean isPremium) { this.isPremium = isPremium; }

    public LocalDateTime getTimestamp() { return timestamp; }
}
