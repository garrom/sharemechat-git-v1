-- V39 (ADR-052 Frente 3 sub-frente 3, 2026-07-25):
-- introduce model_pricing_tiers con versionado effective_from/effective_to
-- (ADR-052 §D5), extiende model_tier_daily_snapshots con columnas del nuevo
-- regimen (ADR-052 §D1/§D2/§D3/§D6), añade users.chosen_rate_eur_per_min y
-- users.pro_accepts_trial (ADR-052 §D2/§D3), y dropea model_earning_tiers
-- junto con el sistema de tiers 5-15/7-20/9-40 (ADR-052 §D12; SUPERSEDES
-- ADR-043 §4).
--
-- Notas de diseño:
-- - model_pricing_tiers usa versionado effective_from/effective_to para
--   auditoria: se puede reconstruir que condiciones estuvieron vigentes
--   en cualquier fecha pasada. Filas vigentes: effective_to IS NULL.
-- - Columnas viejas de model_tier_daily_snapshots (tier_id, tier_name,
--   first_minute_earning_per_min, next_minutes_earning_per_min) se
--   dejan nullable. Los snapshots del sistema previo (mundo pre-V39)
--   las tienen pobladas para auditoria. Los snapshots nuevos las escriben
--   como NULL y usan las columnas nuevas.
-- - Los snapshots historicos con tier_id apuntando a la tabla dropeada
--   quedan como datos auditables aislados sin FK viva (aceptable en TEST
--   sin datos productivos; AUDIT/PROD no tienen aun este frente).

-- =============================================================
-- BLOQUE 1 - CREATE model_pricing_tiers + seed T0/T1/T2/T3
-- =============================================================

CREATE TABLE model_pricing_tiers (
    id                              BIGINT       PRIMARY KEY AUTO_INCREMENT,
    tier_code                       VARCHAR(4)   NOT NULL
        COMMENT 'Identificador del tramo: T0, T1, T2, T3 (ADR-052 §D1).',
    min_billed_gross_eur_30d        DECIMAL(10,2) NOT NULL
        COMMENT 'Umbral inferior de facturacion bruta rolling 30d en EUR (0 para T0).',
    model_share_pct                 DECIMAL(5,2) NOT NULL
        COMMENT '%reparto modelo (75.00, 77.00, 78.00, 79.00).',
    rate_min_eur_per_min            DECIMAL(4,2) NOT NULL
        COMMENT 'Precio minimo por minuto elegible en este tramo.',
    rate_max_eur_per_min            DECIMAL(4,2) NOT NULL
        COMMENT 'Precio maximo por minuto elegible en este tramo.',
    effective_from                  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
        COMMENT 'Inicio de vigencia UTC.',
    effective_to                    DATETIME     NULL
        COMMENT 'Fin de vigencia UTC. NULL para filas vigentes.',
    CONSTRAINT uq_mpt_code_effective UNIQUE (tier_code, effective_from),
    CONSTRAINT chk_mpt_share CHECK (model_share_pct > 0 AND model_share_pct < 100),
    CONSTRAINT chk_mpt_range CHECK (rate_max_eur_per_min >= rate_min_eur_per_min),
    INDEX idx_mpt_vigencia (effective_to, min_billed_gross_eur_30d)
);

INSERT INTO model_pricing_tiers (tier_code, min_billed_gross_eur_30d, model_share_pct, rate_min_eur_per_min, rate_max_eur_per_min)
VALUES
    ('T0',    0.00, 75.00, 1.00, 1.00),
    ('T1', 3500.00, 77.00, 1.00, 3.00),
    ('T2', 5000.00, 78.00, 1.00, 6.00),
    ('T3', 6500.00, 79.00, 1.00, 9.00);

-- =============================================================
-- BLOQUE 2 - Extender model_tier_daily_snapshots
-- =============================================================

-- 2a. Relajar columnas viejas a NULL (los snapshots nuevos no las escriben)
ALTER TABLE model_tier_daily_snapshots
    MODIFY COLUMN tier_id BIGINT NULL,
    MODIFY COLUMN tier_name VARCHAR(50) NULL,
    MODIFY COLUMN first_minute_earning_per_min DECIMAL(10,4) NULL,
    MODIFY COLUMN next_minutes_earning_per_min DECIMAL(10,4) NULL;

-- 2b. Añadir columnas nuevas del nuevo regimen
ALTER TABLE model_tier_daily_snapshots
    ADD COLUMN billed_gross_eur_30d DECIMAL(10,2) NULL
        COMMENT 'Facturacion bruta acumulada rolling 30d en EUR (base del tramo, ADR-052 §D6).',
    ADD COLUMN pricing_tier_id BIGINT NULL
        COMMENT 'FK a model_pricing_tiers vigente en el snapshot date.',
    ADD COLUMN pricing_tier_code VARCHAR(4) NULL
        COMMENT 'Codigo del tramo resuelto (T0/T1/T2/T3) para lectura rapida sin join.',
    ADD COLUMN model_share_pct DECIMAL(5,2) NULL
        COMMENT '%reparto modelo vigente en el snapshot (denormalizado para auditoria).',
    ADD COLUMN rate_min_eur_per_min DECIMAL(4,2) NULL
        COMMENT 'Precio minimo permitido en el tramo (denormalizado).',
    ADD COLUMN rate_max_eur_per_min DECIMAL(4,2) NULL
        COMMENT 'Precio maximo permitido en el tramo (denormalizado).',
    ADD COLUMN pro_status_active BOOLEAN NULL
        COMMENT 'True si en el snapshot la modelo cumple el umbral de Estatus Pro (facturacion bruta rolling 30d > billing.pro-status.min-billed-gross-eur-30d).';

ALTER TABLE model_tier_daily_snapshots
    ADD CONSTRAINT fk_mtds_pricing_tier
        FOREIGN KEY (pricing_tier_id) REFERENCES model_pricing_tiers(id);

-- =============================================================
-- BLOQUE 3 - Añadir columnas users (tarifa autoservicio + toggle Pro)
-- =============================================================

ALTER TABLE users
    ADD COLUMN chosen_rate_eur_per_min DECIMAL(4,2) NOT NULL DEFAULT 1.00
        COMMENT 'Tarifa por minuto elegida por la modelo dentro del rango de su tramo (ADR-052 §D2). Default 1.00 (T0). Se recorta automaticamente al max del tramo destino si la modelo baja de tramo.',
    ADD COLUMN pro_accepts_trial BOOLEAN NOT NULL DEFAULT TRUE
        COMMENT 'Toggle Estatus Pro (ADR-052 §D3): true si la modelo Pro acepta clientes trial. Default true para no romper flujo trial existente cuando Pro se active por primera vez.';

-- =============================================================
-- BLOQUE 4 - DROP model_earning_tiers
-- ADR-052 §D12: sistema de tiers 5-15/7-20/9-40 retirado en su totalidad.
-- Los snapshots historicos que apuntan a esta tabla via tier_id se conservan
-- como datos auditables aislados (FK vive de forma denormalizada en las
-- columnas tier_id/tier_name del propio snapshot).
-- =============================================================

DROP TABLE IF EXISTS model_earning_tiers;
