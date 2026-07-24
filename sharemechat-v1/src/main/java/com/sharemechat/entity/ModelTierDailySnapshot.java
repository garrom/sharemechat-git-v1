package com.sharemechat.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Snapshot diario del estado economico de la modelo. Extendido en V39
 * (ADR-052 Frente 3) con las columnas del nuevo regimen (facturacion
 * bruta rolling 30d, tramo de reparto y rango de precio, Estatus Pro).
 *
 * <p>Las columnas viejas ({@code tierId}, {@code tierName},
 * {@code firstMinuteEarningPerMin}, {@code nextMinutesEarningPerMin})
 * se conservan como nullable para permitir la lectura de snapshots
 * historicos del sistema previo (5-15/7-20/9-40). Los snapshots nuevos
 * las escriben como {@code null}.
 */
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

    // ---- columnas legacy (sistema tiers 5-15/7-20/9-40, ADR-043 §4
    // SUPERSEDED por ADR-052 §D12). Nullable desde V39: los snapshots
    // nuevos las dejan NULL; los snapshots historicos las tienen pobladas.
    @Column(name = "tier_id")
    private Long tierId;

    @Column(name = "tier_name", length = 50)
    private String tierName;

    @Column(name = "first_minute_earning_per_min", precision = 10, scale = 4)
    private BigDecimal firstMinuteEarningPerMin;

    @Column(name = "next_minutes_earning_per_min", precision = 10, scale = 4)
    private BigDecimal nextMinutesEarningPerMin;

    // ---- columnas del nuevo regimen (V39, ADR-052 Frente 3)
    @Column(name = "billed_gross_eur_30d", precision = 10, scale = 2)
    private BigDecimal billedGrossEur30d;

    @Column(name = "pricing_tier_id")
    private Long pricingTierId;

    @Column(name = "pricing_tier_code", length = 4)
    private String pricingTierCode;

    @Column(name = "model_share_pct", precision = 5, scale = 2)
    private BigDecimal modelSharePct;

    @Column(name = "rate_min_eur_per_min", precision = 4, scale = 2)
    private BigDecimal rateMinEurPerMin;

    @Column(name = "rate_max_eur_per_min", precision = 4, scale = 2)
    private BigDecimal rateMaxEurPerMin;

    @Column(name = "pro_status_active")
    private Boolean proStatusActive;

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

    public BigDecimal getBilledGrossEur30d() { return billedGrossEur30d; }
    public void setBilledGrossEur30d(BigDecimal v) { this.billedGrossEur30d = v; }

    public Long getPricingTierId() { return pricingTierId; }
    public void setPricingTierId(Long v) { this.pricingTierId = v; }

    public String getPricingTierCode() { return pricingTierCode; }
    public void setPricingTierCode(String v) { this.pricingTierCode = v; }

    public BigDecimal getModelSharePct() { return modelSharePct; }
    public void setModelSharePct(BigDecimal v) { this.modelSharePct = v; }

    public BigDecimal getRateMinEurPerMin() { return rateMinEurPerMin; }
    public void setRateMinEurPerMin(BigDecimal v) { this.rateMinEurPerMin = v; }

    public BigDecimal getRateMaxEurPerMin() { return rateMaxEurPerMin; }
    public void setRateMaxEurPerMin(BigDecimal v) { this.rateMaxEurPerMin = v; }

    public Boolean getProStatusActive() { return proStatusActive; }
    public void setProStatusActive(Boolean v) { this.proStatusActive = v; }

    public LocalDateTime getCreatedAt(){ return createdAt; }
}
