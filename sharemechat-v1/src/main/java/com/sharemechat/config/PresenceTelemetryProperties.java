package com.sharemechat.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Card 1 Fase 2 (2026-08-18): configuracion de la telemetria de presencia
 * de modelos (histograma "suele estar en linea" de la card + heatmap admin).
 *
 * <p>Mapea {@code presence.telemetry.*} de {@code application.properties}.
 *
 * <p>Kill-switch por {@link #enabled}: cuando {@code false} el
 * {@code PresenceSampleJob} no muestrea ni hace prune (no-op). Arranca
 * {@code false} en todos los entornos salvo PROD; muestrear presencia solo
 * tiene sentido con trafico real (env var {@code PRESENCE_TELEMETRY_ENABLED}).
 * Los endpoints de lectura (card / heatmap admin) van siempre vivos: si no
 * hay muestras devuelven vacio.
 *
 * <p>{@link #zone}: las muestras se sellan y agregan en esta zona horaria
 * (wall-clock), de modo que la agregacion por hora es directa sin CONVERT_TZ.
 * Ver {@code PresenceSampleJob} y {@code PresenceTelemetryService}.
 */
@Component
@ConfigurationProperties(prefix = "presence.telemetry")
public class PresenceTelemetryProperties {

    /** Kill-switch del sampler + prune. Solo PROD en runtime. */
    private boolean enabled = false;

    /** Cron del muestreo. Default cada 10 min. */
    private String sampleCron = "0 */10 * * * *";

    /** Cron del prune de retencion. Default diario 04:30. */
    private String pruneCron = "0 30 4 * * *";

    /** Dias de muestras que se conservan; el prune borra lo mas antiguo. */
    private int retentionDays = 90;

    /** Ventana movil (semanas) usada para agregar el histograma/heatmap. */
    private int aggregationWeeks = 8;

    /** Zona horaria de sellado y agregacion de las muestras. */
    private String zone = "Europe/Madrid";

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public String getSampleCron() { return sampleCron; }
    public void setSampleCron(String sampleCron) { this.sampleCron = sampleCron; }

    public String getPruneCron() { return pruneCron; }
    public void setPruneCron(String pruneCron) { this.pruneCron = pruneCron; }

    public int getRetentionDays() { return retentionDays; }
    public void setRetentionDays(int retentionDays) { this.retentionDays = retentionDays; }

    public int getAggregationWeeks() { return aggregationWeeks; }
    public void setAggregationWeeks(int aggregationWeeks) { this.aggregationWeeks = aggregationWeeks; }

    public String getZone() { return zone; }
    public void setZone(String zone) { this.zone = zone; }
}
