-- V37: politica de cuentas dormidas. Toda cuenta que no registre actividad
-- (login o refresh de token) durante N meses (default 6) se marca inactiva
-- con dormant_since=NOW(). El login posterior la auto-reactiva sin
-- intervencion admin. Bans reales (account_status=SUSPENDED/BANNED o
-- is_active=false sin dormant_since) siguen bloqueando el login.
--
-- Frente separado del programa de afiliacion (higiene de cuenta), no
-- condiciona el revshare (ver ADR-049 D4 revisado 2026-07-23).

ALTER TABLE users
    ADD COLUMN last_activity_at DATETIME NULL
        COMMENT 'Timestamp UTC del ultimo login o refresh exitoso. Base de la politica de cuentas dormidas (V37).';

ALTER TABLE users
    ADD COLUMN dormant_since DATETIME NULL
        COMMENT 'Cuando NOT NULL, la cuenta fue marcada dormant por el AccountDormancyJob. Distingue del bloqueo por ban real (is_active=false sin dormant_since). El login auto-reactiva (dormant_since=NULL) sin intervencion admin.';

CREATE INDEX idx_users_last_activity_at ON users (last_activity_at);
CREATE INDEX idx_users_dormant_since ON users (dormant_since);
