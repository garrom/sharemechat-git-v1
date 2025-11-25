package com.sharemechat.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_trial_streams")
public class UserTrialStream {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // USER que está viendo (role=USER)
    @ManyToOne
    @JoinColumn(name = "viewer_user_id", nullable = false)
    private User viewer;

    // MODELO que está siendo vista
    @ManyToOne
    @JoinColumn(name = "model_id", nullable = false)
    private User model;

    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    @Column(name = "end_time")
    private LocalDateTime endTime;

    @Column(name = "close_reason", length = 50)
    private String closeReason;

    @Column(name = "seconds")
    private Long seconds;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public UserTrialStream() {}

    public Long getId() {
        return id;
    }

    public User getViewer() {
        return viewer;
    }

    public void setViewer(User viewer) {
        this.viewer = viewer;
    }

    public User getModel() {
        return model;
    }

    public void setModel(User model) {
        this.model = model;
    }

    public LocalDateTime getStartTime() {
        return startTime;
    }

    public void setStartTime(LocalDateTime startTime) {
        this.startTime = startTime;
    }

    public LocalDateTime getEndTime() {
        return endTime;
    }

    public void setEndTime(LocalDateTime endTime) {
        this.endTime = endTime;
    }

    public String getCloseReason() {
        return closeReason;
    }

    public void setCloseReason(String closeReason) {
        this.closeReason = closeReason;
    }

    public Long getSeconds() {
        return seconds;
    }

    public void setSeconds(Long seconds) {
        this.seconds = seconds;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
