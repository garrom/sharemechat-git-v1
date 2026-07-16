-- V28: Tabla `psp_provider_config` + seed inicial `nowpayments/DISABLED`
-- (ADR-051 D8 kill-switch runtime).
--
-- Contexto: calcada del schema `kyc_provider_config` (V1__baseline.sql:278)
-- que ya se usa para gobernar el modo activo de KYC (Didit/Veriff/Manual)
-- sin redeploy. Mismo patrón aplicado al PSP.
--
-- Un solo vendor activo a la vez por `provider_key` (UNIQUE). En una
-- futura versión con multi-PSP simultáneo (por ejemplo NOWPayments +
-- Vendo coexistiendo) el `active_mode` puede pasar a un concepto
-- más granular; hoy es suficiente ENABLED / DISABLED.
--
-- Doble kill-switch (D8):
-- 1) Property `psp.<provider>.enabled` (activada por deploy con env var).
-- 2) Esta tabla `active_mode` (activable/desactivable en runtime desde
--    el panel admin sin redeploy).
--
-- Ambas condiciones deben ser TRUE/ENABLED para que el vendor procese
-- checkouts. Cualquiera de las dos apagadas → 503 PSP_UNAVAILABLE.
--
-- Seed inicial: fila `nowpayments/DISABLED`. El operador la activa a
-- ENABLED manualmente cuando (a) las credenciales sandbox estén en
-- secrets.env, (b) el flujo se haya validado end-to-end.

CREATE TABLE psp_provider_config (
    id BIGINT NOT NULL AUTO_INCREMENT,
    provider_key VARCHAR(50) NOT NULL,
    active_mode VARCHAR(20) NOT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    note VARCHAR(255) DEFAULT NULL,
    updated_by_user_id BIGINT DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_psp_provider_config_key (provider_key),
    KEY idx_psp_provider_config_mode (active_mode),
    KEY idx_psp_provider_config_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO psp_provider_config (provider_key, active_mode, enabled, note)
VALUES ('nowpayments', 'DISABLED', 1,
        'Seed inicial ADR-051 Fase 1. Activar a ENABLED cuando (a) credenciales sandbox en secrets.env, (b) adapter validado end-to-end.');
