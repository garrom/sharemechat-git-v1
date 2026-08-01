-- V44 — Capa B de atribucion de origen: persistir la fuente first-touch por
-- usuario registrado (ADR-057).
--
-- Contexto: la capa A (frontend, cookie smc_attribution + evento GA4 sign_up)
-- es anonima y agregada. La capa B guarda la atribucion first-touch (utm +
-- referrer + landing) ATADA al usuario registrado, en NUESTRA BD, para poder
-- analizarla en SQL y cruzarla con revenue/cohortes sin depender de GA4.
--
-- Dataset minimo defendible (GDPR): solo datos de canal de marketing. NO se
-- guarda IP cruda ni user-agent aqui (la IP de registro ya vive en
-- users.regist_ip y el pais en users.country_detected). Base legal: interes
-- legitimo (entender canales de adquisicion); declarado en la politica de
-- privacidad. Los valores los envia el frontend (first-touch desde la cookie),
-- por lo que son auto-declarados por el cliente (aceptable para marketing).
--
-- Tabla 1:1 con users: PK = user_id = FK a users(id) con ON DELETE CASCADE,
-- de modo que el borrado/erasure del usuario arrastra su fila de atribucion.

CREATE TABLE user_acquisition (
    user_id       BIGINT       NOT NULL,
    utm_source    VARCHAR(128) NULL,
    utm_medium    VARCHAR(128) NULL,
    utm_campaign  VARCHAR(191) NULL,
    referrer_host VARCHAR(191) NULL,
    landing_path  VARCHAR(512) NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    CONSTRAINT fk_user_acquisition_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indice para consultas de marketing "cuantos registros por fuente".
CREATE INDEX ix_user_acquisition_source ON user_acquisition (utm_source);
