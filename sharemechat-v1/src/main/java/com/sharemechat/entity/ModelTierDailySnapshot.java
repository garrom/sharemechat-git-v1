package com.sharemechat.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "model_tier_daily_snapshots",
        uniqueConstraints = @UniqueConstraint(name = "uk_model_day", columnNames = {"model_id","snapshot_date"})
)
public class ModelTierDailySnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "model_id", nullable = false)
    private Long modelId;

    @Column(name = "snapshot_date", nullable = false)
    private LocalDate snapshotDate;

    @Column(name = "window_start", nullable = false)
    private LocalDateTime windowStart;

    @Column(name = "window_end", nullable = false)
    private LocalDateTime windowEnd;

    @Column(name = "billed_seconds", nullable = false)
    private Long billedSeconds;

    @Column(name = "billed_minutes", nullable = false)
    private Integer billedMinutes;

    @Column(name = "tier_id", nullable = false)
    private Long tierId;

    @Column(name = "tier_name", nullable = false, length = 50)
    private String tierName;

    @Column(name = "first_minute_earning_per_min", nullable = false, precision = 10, scale = 4)
    private BigDecimal firstMinuteEarningPerMin;

    @Column(name = "next_minutes_earning_per_min", nullable = false, precision = 10, scale = 4)
    private BigDecimal nextMinutesEarningPerMin;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public ModelTierDailySnapshot() {}

    public Long getId(){ return id; }

    public Long getModelId(){ return modelId; }
    public void setModelId(Long modelId){ this.modelId = modelId; }

    public LocalDate getSnapshotDate(){ return snapshotDate; }
    public void setSnapshotDate(LocalDate snapshotDate){ this.snapshotDate = snapshotDate; }

    public LocalDateTime getWindowStart(){ return windowStart; }
    public void setWindowStart(LocalDateTime windowStart){ this.windowStart = windowStart; }

    public LocalDateTime getWindowEnd(){ return windowEnd; }
    public void setWindowEnd(LocalDateTime windowEnd){ this.windowEnd = windowEnd; }

    public Long getBilledSeconds(){ return billedSeconds; }
    public void setBilledSeconds(Long billedSeconds){ this.billedSeconds = billedSeconds; }

    public Integer getBilledMinutes(){ return billedMinutes; }
    public void setBilledMinutes(Integer billedMinutes){ this.billedMinutes = billedMinutes; }

    public Long getTierId(){ return tierId; }
    public void setTierId(Long tierId){ this.tierId = tierId; }

    public String getTierName(){ return tierName; }
    public void setTierName(String tierName){ this.tierName = tierName; }

    public BigDecimal getFirstMinuteEarningPerMin(){ return firstMinuteEarningPerMin; }
    public void setFirstMinuteEarningPerMin(BigDecimal v){ this.firstMinuteEarningPerMin = v; }

    public BigDecimal getNextMinutesEarningPerMin(){ return nextMinutesEarningPerMin; }
    public void setNextMinutesEarningPerMin(BigDecimal v){ this.nextMinutesEarningPerMin = v; }

    public LocalDateTime getCreatedAt(){ return createdAt; }
}
