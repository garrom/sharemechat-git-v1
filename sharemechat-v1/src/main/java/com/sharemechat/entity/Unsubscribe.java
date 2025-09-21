package com.sharemechat.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "unsubscribe")
public class Unsubscribe {

    @Id
    @Column(name = "user_id")
    private Long userId;              // PK = FK a users.id

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;        // fecha de baja

    @Column(name = "reason")
    private String reason;            // motivo opcional

    @Column(name = "created_at", nullable = false, columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt = LocalDateTime.now();

    public Unsubscribe() {}

    public Unsubscribe(Long userId, LocalDate endDate, String reason) {
        this.userId = userId;
        this.endDate = endDate;
        this.reason = reason;
        this.createdAt = LocalDateTime.now();
    }

    // getters/setters


    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDate endDate) {
        this.endDate = endDate;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
