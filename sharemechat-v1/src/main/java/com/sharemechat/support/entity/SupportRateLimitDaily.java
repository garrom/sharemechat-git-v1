package com.sharemechat.support.entity;

import jakarta.persistence.*;

import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Objects;

@Entity
@Table(name = "support_rate_limit_daily")
@IdClass(SupportRateLimitDaily.PK.class)
public class SupportRateLimitDaily {

    @Id
    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Id
    @Column(name = "usage_date", nullable = false)
    private LocalDate usageDate;

    @Column(name = "messages_count", nullable = false)
    private int messagesCount;

    @Column(name = "tokens_count", nullable = false)
    private long tokensCount;

    @Column(name = "exceeded_at")
    private LocalDateTime exceededAt;

    @Column(name = "updated_at", nullable = false,
            columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    private LocalDateTime updatedAt;

    public SupportRateLimitDaily() {
        this.messagesCount = 0;
        this.tokensCount = 0L;
        this.updatedAt = LocalDateTime.now();
    }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public LocalDate getUsageDate() { return usageDate; }
    public void setUsageDate(LocalDate usageDate) { this.usageDate = usageDate; }
    public int getMessagesCount() { return messagesCount; }
    public void setMessagesCount(int messagesCount) { this.messagesCount = messagesCount; }
    public long getTokensCount() { return tokensCount; }
    public void setTokensCount(long tokensCount) { this.tokensCount = tokensCount; }
    public LocalDateTime getExceededAt() { return exceededAt; }
    public void setExceededAt(LocalDateTime exceededAt) { this.exceededAt = exceededAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public static class PK implements Serializable {
        private Long userId;
        private LocalDate usageDate;

        public PK() {}
        public PK(Long userId, LocalDate usageDate) {
            this.userId = userId;
            this.usageDate = usageDate;
        }
        public Long getUserId() { return userId; }
        public void setUserId(Long userId) { this.userId = userId; }
        public LocalDate getUsageDate() { return usageDate; }
        public void setUsageDate(LocalDate usageDate) { this.usageDate = usageDate; }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof PK)) return false;
            PK pk = (PK) o;
            return Objects.equals(userId, pk.userId) && Objects.equals(usageDate, pk.usageDate);
        }

        @Override
        public int hashCode() { return Objects.hash(userId, usageDate); }
    }
}
