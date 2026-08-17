-- V53 (Card 1 Fase 2, 2026-08-18): perfil de modelo — datos fisicos +
-- telemetria de presencia.
--
-- Bloque 1: model_profile_attributes (1:1 con el modelo). Datos fisicos
-- que la modelo declara y el cliente ve en la card ("Ver perfil completo").
-- La EDAD no se guarda: se deriva de users.date_of_birth en el service.
-- Los enums (sex/body_type/butt_size/bust_size) se validan en Java para
-- poder evolucionar sin migracion; por eso NO llevan CHECK en BD.
--
-- Bloque 2: model_presence_samples (write-heavy, volumen bajo). Muestreo
-- periodico de que modelos estan AVAILABLE, tomado por PresenceSampleJob
-- leyendo el set Redis user:available (helper StatusService). Alimenta el
-- histograma "suele estar en linea" de la card y el heatmap admin. El
-- estado BUSY/facturacion NO se muestrea: se deriva de stream_records.
-- La columna status queda para futuro (hoy solo AVAILABLE). Retencion por
-- prune diario (presence.telemetry.retention-days).
--
-- IF NOT EXISTS por coherencia con el resto de migraciones. ddl-auto=validate
-- en TODOS los entornos -> el shape de aqui DEBE coincidir con las entities
-- ModelProfileAttributes / ModelPresenceSample, y con el baseline IT
-- (V1__it_baseline.sql) que consume el perfil ci.

CREATE TABLE IF NOT EXISTS model_profile_attributes (
    user_id     BIGINT NOT NULL,
    sex         VARCHAR(16) NULL,
    bust_size   VARCHAR(16) NULL,
    height_cm   INT NULL,
    butt_size   VARCHAR(16) NULL,
    body_type   VARCHAR(16) NULL,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    CONSTRAINT fk_model_profile_attributes_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS model_presence_samples (
    id             BIGINT NOT NULL AUTO_INCREMENT,
    model_user_id  BIGINT NOT NULL,
    status         VARCHAR(10) NOT NULL DEFAULT 'AVAILABLE',
    sampled_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_model_presence_samples_user
        FOREIGN KEY (model_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_model_presence_samples_status
        CHECK (status IN ('AVAILABLE','BUSY')),
    KEY idx_mps_model_sampled (model_user_id, sampled_at),
    KEY idx_mps_sampled (sampled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
