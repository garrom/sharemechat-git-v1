package com.sharemechat.streammoderation.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Aviso enviado (o intento de envio) al buzon admin al cruzar por
 * primera vez un umbral de consumo Sightengine dentro de un periodo
 * (ADR-037 Fase 5 Bloque 5, Paso 3).
 *
 * <p>La UK {@code (period_type, period_start, threshold_pct)} garantiza
 * idempotencia: si el registro existe, el aviso ya se emitio en ese
 * periodo y no se repite. Al cambiar de periodo (mes / dia) las claves
 * cambian y el mecanismo se resetea de forma natural, sin job de reset.
 *
 * <p>Los campos {@code emailSent} / {@code emailSentAt} permiten
 * distinguir entre "aviso registrado pero email fallo" (en teoria hoy
 * el job hace rollback ante fallo, pero se dejan por trazabilidad
 * futura) y "aviso completo".
 */
@Entity
@Table(
        name = "moderation_usage_alerts",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_moderation_usage_alerts_period_threshold",
                columnNames = {"period_type", "period_start", "threshold_pct"}
        )
)
public class ModerationUsageAlert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "period_type", nullable = false, length = 10)
    private String periodType; // MONTH | DAY

    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;

    @Column(name = "threshold_pct", nullable = false)
    private int thresholdPct;

    @Column(name = "plan_name", nullable = false, length = 20)
    private String planName;

    @Column(name = "quota_at_alert", nullable = false)
    private long quotaAtAlert;

    @Column(name = "operations_at_alert", nullable = false)
    private long operationsAtAlert;

    @Column(name = "pct_at_alert", nullable = false, precision = 5, scale = 1)
    private BigDecimal pctAtAlert;

    @Column(name = "email_sent", nullable = false)
    private boolean emailSent;

    @Column(name = "email_sent_at")
    private LocalDateTime emailSentAt;

    @Column(name = "email_to", length = 200)
    private String emailTo;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public Long getId() { return id; }

    public String getPeriodType() { return periodType; }
    public void setPeriodType(String periodType) { this.periodType = periodType; }

    public LocalDate getPeriodStart() { return periodStart; }
    public void setPeriodStart(LocalDate periodStart) { this.periodStart = periodStart; }

    public int getThresholdPct() { return thresholdPct; }
    public void setThresholdPct(int thresholdPct) { this.thresholdPct = thresholdPct; }

    public String getPlanName() { return planName; }
    public void setPlanName(String planName) { this.planName = planName; }

    public long getQuotaAtAlert() { return quotaAtAlert; }
    public void setQuotaAtAlert(long quotaAtAlert) { this.quotaAtAlert = quotaAtAlert; }

    public long getOperationsAtAlert() { return operationsAtAlert; }
    public void setOperationsAtAlert(long operationsAtAlert) { this.operationsAtAlert = operationsAtAlert; }

    public BigDecimal getPctAtAlert() { return pctAtAlert; }
    public void setPctAtAlert(BigDecimal pctAtAlert) { this.pctAtAlert = pctAtAlert; }

    public boolean isEmailSent() { return emailSent; }
    public void setEmailSent(boolean emailSent) { this.emailSent = emailSent; }

    public LocalDateTime getEmailSentAt() { return emailSentAt; }
    public void setEmailSentAt(LocalDateTime emailSentAt) { this.emailSentAt = emailSentAt; }

    public String getEmailTo() { return emailTo; }
    public void setEmailTo(String emailTo) { this.emailTo = emailTo; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
