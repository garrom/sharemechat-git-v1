package com.sharemechat.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Tramo de reparto y rango de precio del sistema del ADR-052 (rediseño
 * estructural del reparto modelo/empresa). Versionado por
 * {@code effective_from}/{@code effective_to} para preservar el histórico
 * de que condiciones estuvieron vigentes en qué fecha (necesario cuando
 * la modelo cita comercialmente las condiciones y hay disputa).
 *
 * <p>Cuatro filas iniciales (V39):
 * <ul>
 *   <li>T0: [0, 3500) €, 75% modelo, 1 €/min fijo.</li>
 *   <li>T1: [3500, 5000) €, 77% modelo, 1-3 €/min.</li>
 *   <li>T2: [5000, 6500) €, 78% modelo, 1-6 €/min.</li>
 *   <li>T3: [6500, +∞) €, 79% modelo, 1-9 €/min.</li>
 * </ul>
 *
 * <p>La resolucion del tramo para una modelo dada usa la facturacion bruta
 * rolling 30d y busca la fila con el mayor {@code min_billed_gross_eur_30d}
 * <= facturacion, entre las filas con {@code effective_to IS NULL} (o con
 * la fecha del snapshot dentro del rango).
 */
@Entity
@Table(name = "model_pricing_tiers")
public class ModelPricingTier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tier_code", nullable = false, length = 4)
    private String tierCode;

    @Column(name = "min_billed_gross_eur_30d", nullable = false, precision = 10, scale = 2)
    private BigDecimal minBilledGrossEur30d;

    @Column(name = "model_share_pct", nullable = false, precision = 5, scale = 2)
    private BigDecimal modelSharePct;

    @Column(name = "rate_min_eur_per_min", nullable = false, precision = 4, scale = 2)
    private BigDecimal rateMinEurPerMin;

    @Column(name = "rate_max_eur_per_min", nullable = false, precision = 4, scale = 2)
    private BigDecimal rateMaxEurPerMin;

    @Column(name = "effective_from", nullable = false)
    private LocalDateTime effectiveFrom;

    @Column(name = "effective_to")
    private LocalDateTime effectiveTo;

    public ModelPricingTier() {}

    public Long getId() { return id; }

    public String getTierCode() { return tierCode; }
    public void setTierCode(String tierCode) { this.tierCode = tierCode; }

    public BigDecimal getMinBilledGrossEur30d() { return minBilledGrossEur30d; }
    public void setMinBilledGrossEur30d(BigDecimal v) { this.minBilledGrossEur30d = v; }

    public BigDecimal getModelSharePct() { return modelSharePct; }
    public void setModelSharePct(BigDecimal v) { this.modelSharePct = v; }

    public BigDecimal getRateMinEurPerMin() { return rateMinEurPerMin; }
    public void setRateMinEurPerMin(BigDecimal v) { this.rateMinEurPerMin = v; }

    public BigDecimal getRateMaxEurPerMin() { return rateMaxEurPerMin; }
    public void setRateMaxEurPerMin(BigDecimal v) { this.rateMaxEurPerMin = v; }

    public LocalDateTime getEffectiveFrom() { return effectiveFrom; }
    public void setEffectiveFrom(LocalDateTime v) { this.effectiveFrom = v; }

    public LocalDateTime getEffectiveTo() { return effectiveTo; }
    public void setEffectiveTo(LocalDateTime v) { this.effectiveTo = v; }
}
