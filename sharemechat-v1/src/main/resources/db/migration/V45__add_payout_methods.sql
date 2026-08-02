-- V45 (ADR-056 Fase S6.a, 2026-08-02): tabla payout_methods.
--
-- Materialización de la tabla que sustenta a
-- com.sharemechat.payout.entity.PayoutMethod (entity + repo sembrados
-- ya en Fase S1, 2026-07-29, patrón "estructura primero, tabla luego").
--
-- Libreta de métodos de cobro del usuario (Master en S6.a; Modelo en
-- iter posterior). En esta fase la tabla existe y se puebla via
-- endpoints CRUD autoservicio, pero NO se linka todavía con
-- payout_requests — el channel del PayoutRequest sigue siendo el
-- string libre del DTO (deuda: refactor requestPayout en S6.b para
-- aceptar payout_method_id).
--
-- Rails soportados (CHECK en BD, validación de account_ref por rail
-- se hace en Java):
--   PAXUM               → account_ref = email Paxum
--   YOURSAFE            → account_ref = reference/IBAN Yoursafe
--   NOWPAYMENTS_CRYPTO  → account_ref = wallet address (currency implicit
--                                       en display_alias o rail sub-tag
--                                       futuro; MVP acepta wallet plano)
--   SEPA_MANUAL         → account_ref = IBAN
--
-- is_default: como MySQL 8 no soporta índices únicos parciales
-- (WHERE is_default=1), la mutual exclusion se garantiza en el
-- PayoutMethodService (al set default, unset el previo del mismo
-- user en la misma transacción).
--
-- verified_at: NULL hasta que un admin (o adapter futuro) verifica
-- que la cuenta es correcta. En S6.a los métodos se crean con
-- verified_at=NULL y admin los aprueba manualmente.

-- IF NOT EXISTS: la entity PayoutMethod + repository existen desde S1
-- (2026-07-29) y Hibernate con ddl-auto=update pudo haber creado la
-- tabla antes de que existiera esta migration. Sin el IF NOT EXISTS,
-- Flyway rompe el arranque en TEST/AUDIT con "Table already exists".
-- El schema real de la entity ES la fuente de verdad; esta migration
-- solo asegura que la tabla existe con este mismo shape para entornos
-- limpios (PROD). Los CHECK/INDEX se materializan aquí también con
-- IF NOT EXISTS implícito (MySQL 8 ignora duplicados si el nombre
-- coincide; ADD CONSTRAINT sí falla, por eso están dentro del CREATE).
CREATE TABLE IF NOT EXISTS payout_methods (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT NOT NULL,
    rail            VARCHAR(30) NOT NULL,
    account_ref     VARCHAR(255) NOT NULL,
    display_alias   VARCHAR(80) NULL,
    is_default      TINYINT(1) NOT NULL DEFAULT 0,
    verified_at     TIMESTAMP NULL DEFAULT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_payout_methods_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT chk_payout_methods_rail
        CHECK (rail IN ('PAXUM','YOURSAFE','NOWPAYMENTS_CRYPTO','SEPA_MANUAL')),
    INDEX idx_payout_methods_user (user_id),
    INDEX idx_payout_methods_user_default (user_id, is_default)
);
