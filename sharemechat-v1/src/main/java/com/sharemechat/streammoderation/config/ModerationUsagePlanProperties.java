package com.sharemechat.streammoderation.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Plan comercial contratado con el vendor de moderacion visual
 * (Sightengine hoy, ADR-037) y umbrales de alerta contra el cupo.
 *
 * <p>Mapea {@code moderation.sightengine.plan.*} en
 * {@code application.properties}. Cuenta unica compartida
 * TEST/AUDIT/PROD (ADR-037): sin override por entorno, cuando
 * cambia de plan se editan 3 lineas en el default y se redespliega.
 *
 * <p>Los porcentajes gobiernan la alerta operativa del Bloque 5
 * (endpoint {@code GET /api/admin/moderation/usage} + job de aviso
 * al buzon admin). Un valor 0 desactiva ese umbral concreto.
 *
 * <p>Introducido 2026-07-21 como Paso 2 Bloque 5 del frente
 * "prueba gratis SFW".
 */
@Component
@ConfigurationProperties(prefix = "moderation.sightengine.plan")
public class ModerationUsagePlanProperties {

    private String name = "UNKNOWN";
    private long monthlyQuota = 0L;
    private long dailyQuota = 0L;
    private int monthWarnPct = 60;
    private int monthAlertPct = 85;
    private int monthCriticalPct = 95;
    private int dayWarnPct = 80;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public long getMonthlyQuota() { return monthlyQuota; }
    public void setMonthlyQuota(long monthlyQuota) { this.monthlyQuota = monthlyQuota; }

    public long getDailyQuota() { return dailyQuota; }
    public void setDailyQuota(long dailyQuota) { this.dailyQuota = dailyQuota; }

    public int getMonthWarnPct() { return monthWarnPct; }
    public void setMonthWarnPct(int monthWarnPct) { this.monthWarnPct = monthWarnPct; }

    public int getMonthAlertPct() { return monthAlertPct; }
    public void setMonthAlertPct(int monthAlertPct) { this.monthAlertPct = monthAlertPct; }

    public int getMonthCriticalPct() { return monthCriticalPct; }
    public void setMonthCriticalPct(int monthCriticalPct) { this.monthCriticalPct = monthCriticalPct; }

    public int getDayWarnPct() { return dayWarnPct; }
    public void setDayWarnPct(int dayWarnPct) { this.dayWarnPct = dayWarnPct; }
}
