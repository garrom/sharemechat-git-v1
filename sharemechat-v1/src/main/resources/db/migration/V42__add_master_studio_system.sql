-- V42 (ADR-056, 2026-07-29): sistema Master/Studio.
--
-- Introduce el rol MASTER (estudios de webcam) como entidad de dominio
-- propia + reparto economico dual INDIVIDUAL vs MASTER + escalado agregado
-- por Master + extensiones auxiliares (password temporal onboarding modelo,
-- attributed_model para trazabilidad de STREAM_EARNING al Master,
-- payout_methods multi-rail).
--
-- Reemplaza parcialmente ADR-052 D1 (%reparto 75-79%) y D5 (umbrales
-- 3500/5000/6500). Cierra vigencia de las 4 filas actuales de
-- model_pricing_tiers y siembra 8 nuevas (4 INDIVIDUAL + 4 MASTER).
--
-- Umbrales absolutos INDIVIDUAL == MASTER (Opcion X del analisis):
-- 0/1000/4000/15000 EUR/30d. Sacados de LiveJasmin oficial L1/L3/L5/L7
-- equivalente EUR mensual. Referencia sectorial, no inventados.

-- ============================================================
-- Bloque 1: nuevo rol MASTER + user_type
-- ============================================================
-- No hay CHECK en users.role (verificado en V1__baseline.sql:782-821).
-- Constants.java se actualiza en la capa Java para incluir:
--   Roles.MASTER = "MASTER"
--   UserTypes.FORM_MASTER = "FORM_MASTER"
--   SessionTypes.MASTER = "MASTER"

-- ============================================================
-- Bloque 2: tabla masters (1-a-1 con users)
-- ============================================================
CREATE TABLE masters (
    user_id                       BIGINT       PRIMARY KEY,
    company_name                  VARCHAR(200) NULL,
    company_registration_number   VARCHAR(100) NULL,
    company_country               VARCHAR(2)   NULL,
    total_models_active           INT          NOT NULL DEFAULT 0,
    total_paid_out_eur            DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    onboarded_at                  DATETIME     NULL,
    created_at                    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_masters_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================
-- Bloque 3: relacion modelo -> master
-- ============================================================
-- Nullable: modelo individual (sin Master) tiene master_user_id = NULL.
-- FK sin ON DELETE CASCADE porque suspension Master libera modelos
-- (D11), no las borra. La liberacion la gestiona el servicio.
ALTER TABLE models
    ADD COLUMN master_user_id BIGINT NULL,
    ADD CONSTRAINT fk_models_master FOREIGN KEY (master_user_id) REFERENCES users(id),
    ADD INDEX idx_models_master (master_user_id);

-- ============================================================
-- Bloque 4: acuerdo interno Master <-> modelo (opaco, auditoria)
-- ============================================================
-- Registra el % que Master pacta con cada modelo. NO participa en el
-- calculo del reparto plataforma (D10 opacidad interna). Solo para
-- trazabilidad ante reclamacion futura y para dashboard reducido
-- que muestra a la modelo cuanto le va a pagar Master.
CREATE TABLE master_model_splits (
    id                     BIGINT       PRIMARY KEY AUTO_INCREMENT,
    master_user_id         BIGINT       NOT NULL,
    model_user_id          BIGINT       NOT NULL,
    internal_share_pct     DECIMAL(5,2) NOT NULL,
    effective_from         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    effective_to           DATETIME     NULL,
    set_by_master_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes                  TEXT         NULL,
    CONSTRAINT fk_mms_master FOREIGN KEY (master_user_id) REFERENCES users(id),
    CONSTRAINT fk_mms_model FOREIGN KEY (model_user_id) REFERENCES users(id),
    CONSTRAINT chk_mms_share CHECK (internal_share_pct >= 0 AND internal_share_pct <= 100),
    INDEX idx_mms_master (master_user_id, effective_to),
    INDEX idx_mms_model (model_user_id, effective_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================
-- Bloque 5: aceptacion contrato Master (simetrico a model_contract_acceptances)
-- ============================================================
CREATE TABLE master_contract_acceptances (
    id                BIGINT       PRIMARY KEY AUTO_INCREMENT,
    user_id           BIGINT       NOT NULL,
    contract_version  VARCHAR(50)  NOT NULL,
    contract_sha256   VARCHAR(64)  NOT NULL,
    accepted_at       DATETIME     NOT NULL,
    ip_address        VARCHAR(64)  NULL,
    user_agent        VARCHAR(255) NULL,
    created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_master_contract_user_version UNIQUE (user_id, contract_version),
    INDEX idx_mca_user (user_id),
    CONSTRAINT fk_master_contract_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================
-- Bloque 6: refactor model_pricing_tiers para regimen dual
-- ============================================================
-- Cerrar vigencia actual de las 4 filas T1-T4 (que tienen umbrales
-- y % del ADR-052 sistema anterior: 75/77/78/79%, umbrales 0/3500/5000/6500).
UPDATE model_pricing_tiers
   SET effective_to = CURRENT_TIMESTAMP
 WHERE effective_to IS NULL;

-- Anyadir columna target_type y ajustar UNIQUE constraint.
-- El UNIQUE previo uq_mpt_code_effective (tier_code, effective_from) se
-- sustituye por (target_type, tier_code, effective_from) para permitir
-- seed simultanea INDIVIDUAL + MASTER con mismo tier_code y mismo
-- effective_from. Nombre real V39: uq_mpt_code_effective.
ALTER TABLE model_pricing_tiers
    ADD COLUMN target_type VARCHAR(15) NOT NULL DEFAULT 'INDIVIDUAL' AFTER tier_code,
    DROP INDEX uq_mpt_code_effective,
    ADD CONSTRAINT chk_mpt_target_type CHECK (target_type IN ('INDIVIDUAL','MASTER')),
    ADD CONSTRAINT uq_mpt_target_code_effective UNIQUE (target_type, tier_code, effective_from);

-- Seed 4 filas regimen INDIVIDUAL post-ADR-056.
-- Umbrales L1/L3/L5/L7 LiveJasmin equivalente EUR/30d.
INSERT INTO model_pricing_tiers
    (tier_code, target_type, min_billed_gross_eur_30d, model_share_pct, rate_min_eur_per_min, rate_max_eur_per_min, effective_from)
VALUES
    ('T1', 'INDIVIDUAL', 0.00,     50.00, 1.00, 1.00, CURRENT_TIMESTAMP),
    ('T2', 'INDIVIDUAL', 1000.00,  54.00, 1.00, 3.00, CURRENT_TIMESTAMP),
    ('T3', 'INDIVIDUAL', 4000.00,  57.00, 1.00, 6.00, CURRENT_TIMESTAMP),
    ('T4', 'INDIVIDUAL', 15000.00, 60.00, 1.00, 9.00, CURRENT_TIMESTAMP);

-- Seed 4 filas regimen MASTER post-ADR-056.
-- Mismos umbrales absolutos que INDIVIDUAL (Opcion X del analisis),
-- pero % model_share_pct superior para dar ventaja competitiva al Master.
INSERT INTO model_pricing_tiers
    (tier_code, target_type, min_billed_gross_eur_30d, model_share_pct, rate_min_eur_per_min, rate_max_eur_per_min, effective_from)
VALUES
    ('T1', 'MASTER', 0.00,     50.00, 1.00, 1.00, CURRENT_TIMESTAMP),
    ('T2', 'MASTER', 1000.00,  60.00, 1.00, 3.00, CURRENT_TIMESTAMP),
    ('T3', 'MASTER', 4000.00,  65.00, 1.00, 6.00, CURRENT_TIMESTAMP),
    ('T4', 'MASTER', 15000.00, 70.00, 1.00, 9.00, CURRENT_TIMESTAMP);

-- ============================================================
-- Bloque 7: extension model_tier_daily_snapshots con target_type
-- ============================================================
-- Los snapshots pre-V42 quedan con target_type = NULL. Deuda #D-54
-- registrada para retropoblar 'INDIVIDUAL' si el reporting historico
-- lo requiere en el futuro.
ALTER TABLE model_tier_daily_snapshots
    ADD COLUMN target_type VARCHAR(15) NULL COMMENT 'INDIVIDUAL o MASTER (post ADR-056)',
    ADD COLUMN master_user_id BIGINT NULL COMMENT 'Presente si target_type=MASTER, indica el Master cuyo bruto agregado se computo',
    ADD INDEX idx_mtds_master (master_user_id, snapshot_date),
    ADD CONSTRAINT fk_mtds_master FOREIGN KEY (master_user_id) REFERENCES users(id);

-- ============================================================
-- Bloque 8: atribucion de STREAM_EARNING/TRIAL_EARNING a Master + modelo
-- ============================================================
-- Cuando el reparto va al Master (modelo bajo umbrella), la Transaction
-- tiene user_id = master y attributed_model_user_id = modelo que origino
-- el ingreso. Trazabilidad para reporting y auditoria.
ALTER TABLE transactions
    ADD COLUMN attributed_model_user_id BIGINT NULL COMMENT 'Modelo que origino el ingreso cuando user=Master (ADR-056)',
    ADD CONSTRAINT fk_tx_attributed_model FOREIGN KEY (attributed_model_user_id) REFERENCES users(id),
    ADD INDEX idx_tx_attributed_model (attributed_model_user_id);

-- ============================================================
-- Bloque 9: password_temporary flag (ADR-056 D7)
-- ============================================================
-- Cuando el Master crea una modelo bajo su umbrella, la fila users se
-- crea sin password funcional (password_temporary=1). La modelo recibe
-- email de activacion + crea su propia password al primer login. En ese
-- punto password_temporary pasa a 0 y first_password_change_at se puebla.
-- Elimina el vector de coaccion Master -> modelo al momento de firmar
-- contrato y KYC (GDPR consentimiento libre).
ALTER TABLE users
    ADD COLUMN password_temporary TINYINT(1) NOT NULL DEFAULT 0
        COMMENT 'ADR-056 D7: si 1, forzar cambio password al primer login antes de firmar/KYC',
    ADD COLUMN first_password_change_at DATETIME NULL
        COMMENT 'Auditoria: instante en que el usuario cambio password por primera vez';

-- ============================================================
-- Bloque 10: payout_methods multi-rail (ADR-056 D12)
-- ============================================================
-- Aplica a modelos individuales y Masters. Rails soportados: PAXUM
-- (S6 prioritario), YOURSAFE (#D-52), NOWPAYMENTS_CRYPTO (#D-53),
-- SEPA_MANUAL (fallback noop, requiere intervencion admin).
CREATE TABLE payout_methods (
    id             BIGINT       PRIMARY KEY AUTO_INCREMENT,
    user_id        BIGINT       NOT NULL,
    rail           VARCHAR(30)  NOT NULL,
    account_ref    VARCHAR(255) NOT NULL,
    display_alias  VARCHAR(80)  NULL,
    is_default     TINYINT(1)   NOT NULL DEFAULT 0,
    verified_at    DATETIME     NULL,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_payout_methods_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT chk_payout_methods_rail CHECK (rail IN (
        'PAXUM', 'YOURSAFE', 'NOWPAYMENTS_CRYPTO', 'SEPA_MANUAL'
    )),
    CONSTRAINT uq_payout_methods_user_rail_ref UNIQUE (user_id, rail, account_ref),
    INDEX idx_payout_methods_user (user_id, is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE payout_requests
    ADD COLUMN payout_method_id BIGINT NULL,
    ADD COLUMN rail VARCHAR(30) NULL COMMENT 'Denormalizado desde payout_methods.rail para reporting',
    ADD CONSTRAINT fk_payout_requests_method FOREIGN KEY (payout_method_id) REFERENCES payout_methods(id),
    ADD INDEX idx_payout_requests_rail (rail, status);
