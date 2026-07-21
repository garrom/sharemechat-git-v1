-- V30: registro de avisos enviados al buzon admin cuando el consumo
-- Sightengine cruza umbrales configurados (ADR-037 Fase 5 Bloque 5,
-- Paso 3). Una fila por (periodo, umbral) sirve como semaforo idempotente:
-- si existe, no se vuelve a avisar en ese periodo; al cambiar de periodo
-- las claves cambian y el mecanismo se resetea de forma natural.
--
-- period_type: 'MONTH' | 'DAY'
-- period_start: primer dia del mes (para MONTH) o dia natural (para DAY)
-- threshold_pct: 60 / 85 / 95 (mes) | 80 (dia)
--
-- La UK (period_type, period_start, threshold_pct) impide duplicados
-- entre concurrencias eventuales del job.

CREATE TABLE moderation_usage_alerts (
    id                    BIGINT       AUTO_INCREMENT PRIMARY KEY,
    period_type           VARCHAR(10)  NOT NULL,
    period_start          DATE         NOT NULL,
    threshold_pct         INT          NOT NULL,
    plan_name             VARCHAR(20)  NOT NULL,
    quota_at_alert        BIGINT       NOT NULL,
    operations_at_alert   BIGINT       NOT NULL,
    pct_at_alert          DECIMAL(5,1) NOT NULL,
    email_sent            TINYINT(1)   NOT NULL DEFAULT 0,
    email_sent_at         DATETIME     NULL,
    email_to              VARCHAR(200) NULL,
    created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_moderation_usage_alerts_period_threshold
        UNIQUE (period_type, period_start, threshold_pct)
);
