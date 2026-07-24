-- V38 (ADR-052 §D11, 2026-07-24): retirada total del programa de afiliadas.
--
-- El programa introducido por V16 (ADR-049), extendido por V17 (favorite_source),
-- V18 (source_type generico) y V36 (first_stream_charge_at) queda eliminado.
-- El reparto escalonado 75-79% modelo del ADR-052 sobre-incentiva a la modelo
-- a traer clientes propios sin necesidad de programa de afiliacion.
--
-- Orden del drop:
-- 1. Convertir payout_requests.payout_type='AFFILIATE' a 'STREAM' antes de
--    droppear la columna (los payouts historicos con AFFILIATE se preservan
--    como filas STREAM; se pierde la marca semantica pero no la evidencia
--    contable del importe).
-- 2. DROP INDEX + DROP CHECK + DROP FK antes de DROP COLUMN cuando aplique
--    (MySQL 8 exige orden explicito para constraints con FK que la referencian).
-- 3. DROP TABLE en orden hijas -> padres.
-- 4. DROP COLUMN en users, payout_requests, favorites_models.
--
-- Sin backfill de retirada de operation_type historicos (REFERRAL_WELCOME_*):
-- decision explicita del operador de mantener las constantes en Constants
-- como legacy no-emisibles para que Hibernate lea filas historicas del
-- ledger sin crash. Ver known-debt.md #D-26.

-- =============================================================
-- BLOQUE 1 - Normalizar payout_requests.payout_type a STREAM
-- =============================================================

UPDATE payout_requests
   SET payout_type = 'STREAM'
 WHERE payout_type = 'AFFILIATE';

-- =============================================================
-- BLOQUE 2 - DROP tabla `affiliate_click_events`
-- =============================================================

DROP TABLE IF EXISTS affiliate_click_events;

-- =============================================================
-- BLOQUE 3 - DROP tabla `affiliate_commissions`
-- (Tiene FK a users x2, payment_sessions, payout_requests. Drop en cascada
--  implicito con DROP TABLE porque MySQL retira las FKs propias de la tabla
--  droppeada. Las tablas referenciadas no se ven afectadas.)
-- =============================================================

DROP TABLE IF EXISTS affiliate_commissions;

-- =============================================================
-- BLOQUE 4 - DROP tabla `affiliate_link_tokens`
-- =============================================================

DROP TABLE IF EXISTS affiliate_link_tokens;

-- =============================================================
-- BLOQUE 5 - Retirar columnas de `users`
-- Requiere retirar FK, UNIQUE, CHECK e INDEX antes de las columnas.
-- =============================================================

ALTER TABLE users
    DROP FOREIGN KEY fk_users_referred_by;

ALTER TABLE users
    DROP INDEX idx_users_referred_by;

ALTER TABLE users
    DROP INDEX uq_users_referral_code_owner;

ALTER TABLE users
    DROP CHECK chk_users_referral_code_owner_charset;

ALTER TABLE users
    DROP INDEX idx_users_first_stream_charge_at;

ALTER TABLE users
    DROP COLUMN referred_by_user_id,
    DROP COLUMN referred_at,
    DROP COLUMN referral_code_owner,
    DROP COLUMN first_stream_charge_at;

-- =============================================================
-- BLOQUE 6 - Retirar columna `payout_type` en `payout_requests`
-- =============================================================

ALTER TABLE payout_requests
    DROP INDEX idx_pr_payout_type;

ALTER TABLE payout_requests
    DROP CHECK chk_pr_payout_type;

ALTER TABLE payout_requests
    DROP COLUMN payout_type;

-- =============================================================
-- BLOQUE 7 - Retirar columna `favorite_source` en `favorites_models`
-- (Decision operador: drop columna completa, se pierde evidencia historica
--  de AFFILIATE_INVITATION pero los favoritos correspondientes sobreviven
--  como filas normales.)
-- =============================================================

ALTER TABLE favorites_models
    DROP INDEX idx_fav_models_source;

ALTER TABLE favorites_models
    DROP CHECK chk_fav_models_source;

ALTER TABLE favorites_models
    DROP COLUMN favorite_source;
