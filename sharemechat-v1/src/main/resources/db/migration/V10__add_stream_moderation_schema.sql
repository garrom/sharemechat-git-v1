-- ============================================================
-- V10__add_stream_moderation_schema.sql
-- ============================================================
-- Sub-paquete P1.1 del frente Moderacion IA del streaming
-- (ADR-030 build vs rent zanjado; ADR-036 postura arquitectonica
--  con captura cliente-side y fail-closed-soft; ADR-037 Sightengine
--  como Plan A vendor visual).
--
-- Crea el schema base del dominio "stream moderation" aislado de los
-- otros dominios de moderacion ya existentes en el repo:
--   * moderation_reports (V1)        -> abuse reports usuario->usuario
--   * model_asset_reviews (V4)       -> moderacion catalogo perfil modelo
--   * model_review_checklist (V1)    -> checklist KYC documental modelo
--   * content_review_events (CMS)    -> workflow editorial CMS
--
-- Prefijo unico stream_moderation_* para todas las tablas nuevas.
-- Patron vendor-agnostic calcado de kyc_sessions / kyc_webhook_events /
-- kyc_provider_config (frente Didit ADR-035): el nombre del vendor solo
-- aparece en valores VARCHAR de las columnas provider / active_mode y
-- en config (moderation.<vendor>.*). Entidades, tablas, columnas,
-- repositorios y DTOs son agnostic.
--
-- Tablas creadas:
--   1. stream_moderation_provider_config (calca kyc_provider_config;
--      INSERT seed inicial activa el modo MOCK)
--   2. stream_moderation_sessions        (1 fila por stream sometido
--      a muestreo; UK simple 1:1 stream<->sesion)
--   3. stream_moderation_events          (eventos crudos del vendor;
--      idempotencia (provider, provider_event_id))
--   4. stream_moderation_reviews         (cola humana priorizada;
--      idempotencia (provider, provider_event_id))
--   5. stream_moderation_attendance      (skeleton attendance log,
--      defensa anti-chargeback)
--
-- Modos VARCHAR + CHECK constraints (no ENUM nativo de MySQL,
-- coherente con la convencion V4):
--   provider                MOCK | SIGHTENGINE | HIVE | REKOGNITION
--   active_mode (config)    MOCK | SIGHTENGINE | HIVE | REKOGNITION
--   sessions.status         ACTIVE | STOPPED | ERROR | DEGRADED
--   sessions.sampling_strategy  INTERVAL | EVENT | HYBRID
--   events.event_type       VERDICT_RECEIVED | VERDICT_TIMEOUT |
--                           VERDICT_ERROR | WEBHOOK_RECEIVED
--   reviews.status          PENDING | IN_REVIEW | APPROVED |
--                           REJECTED | CANCELLED
--   reviews.severity        GREEN | AMBER | RED | CRITICAL
--   reviews.category        NUDITY | WEAPONS | DRUGS | VIOLENCE |
--                           GORE | SELF_HARM | GAMBLING |
--                           OFFENSIVE_SYMBOLS | MINORS | OTHER
--
-- Charset/collation: utf8mb4 / utf8mb4_0900_ai_ci en las 5 tablas
-- (coherente con V4, ultimo precedente de CREATE TABLE en migracion
-- aparte).
--
-- Patron de seed inicial: a diferencia de kyc_provider_config (que NO
-- inserta seed en V1 y se bootstrapea lazy via
-- KycProviderConfigService.getOrCreateModelOnboardingConfig), aqui
-- SI se inserta seed dentro de la migracion. Decision deliberada del
-- operador (P1.1 Fase A pregunta F4): tener el seed visible en la
-- migracion es mas auditable que un orElseGet silencioso en service.
-- La divergencia respecto al patron KYC es consciente.
--
-- Idempotencia: NO idempotente. Flyway garantiza ejecucion unica.
--
-- Ventana de mantenimiento: el JAR posterior (P1.2) tendra entidades
-- y servicios que asumen la existencia de estas tablas; aplicar V10
-- y arrancar JAR P1.2 en el mismo despliegue. Mientras este V10 viva
-- sin JAR P1.2 (entre P1.1 y P1.2), el JAR previo ignora estas tablas
-- (no las lee).
-- ============================================================


-- ------------------------------------------------------------
-- Paso 1: stream_moderation_provider_config + seed
-- (1 fila por dominio; calca kyc_provider_config)
-- ------------------------------------------------------------
CREATE TABLE stream_moderation_provider_config (
    id                   BIGINT       NOT NULL AUTO_INCREMENT,
    provider_key         VARCHAR(50)  NOT NULL,
    active_mode          VARCHAR(20)  NOT NULL DEFAULT 'MOCK',
    enabled              BOOLEAN      NOT NULL DEFAULT TRUE,
    note                 VARCHAR(255) DEFAULT NULL,
    updated_by_user_id   BIGINT       DEFAULT NULL,
    created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_stream_moderation_provider_config_key (provider_key),
    KEY idx_stream_moderation_provider_config_mode (active_mode),
    KEY idx_stream_moderation_provider_config_enabled (enabled),
    CONSTRAINT fk_stream_moderation_provider_config_updated_by
        FOREIGN KEY (updated_by_user_id) REFERENCES users (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_stream_moderation_provider_config_mode
        CHECK (active_mode IN ('MOCK','SIGHTENGINE','HIVE','REKOGNITION'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Seed inicial: P1.1 arranca en modo MOCK sin coste y sin credenciales.
-- Cambio a SIGHTENGINE se hace en P1.2/P1.3 via endpoint admin
-- (analogo a POST /api/admin/kyc/model-onboarding/mode existente).
INSERT INTO stream_moderation_provider_config
    (provider_key, active_mode, enabled, note)
VALUES
    ('STREAM_VISUAL_MODERATION', 'MOCK', TRUE,
     'Initial seed - P1.1 schema bootstrap (ADR-036/ADR-037)');


-- ------------------------------------------------------------
-- Paso 2: stream_moderation_sessions
-- (1 fila por stream sometido a muestreo; ciclo de vida del muestreo;
--  UK simple 1:1 stream<->sesion. Si en P1.2 se descubre necesidad
--  multi-fila, dropear UK con V11.)
-- ------------------------------------------------------------
CREATE TABLE stream_moderation_sessions (
    id                          BIGINT       NOT NULL AUTO_INCREMENT,
    stream_record_id            BIGINT       NOT NULL,
    provider                    VARCHAR(20)  NOT NULL,
    -- providerSessionId del vendor cuando aplique (sync image API puede
    -- no devolver session id; nullable). Idempotencia primaria via
    -- (provider, provider_event_id) en stream_moderation_events.
    provider_session_id         VARCHAR(100) DEFAULT NULL,
    sampling_cadence_seconds    INT          NOT NULL DEFAULT 15,
    sampling_strategy           VARCHAR(20)  NOT NULL DEFAULT 'INTERVAL',
    status                      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    started_at                  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    stopped_at                  DATETIME     DEFAULT NULL,
    -- Contadores para metricas operativas y dashboard P1.3.
    frames_submitted            INT          NOT NULL DEFAULT 0,
    verdicts_received           INT          NOT NULL DEFAULT 0,
    -- Fail-closed-soft (ADR-036 bloque 3): instante en que el vendor
    -- empezo a no responder. Si pasa el threshold X de minutos, la
    -- sesion se corta. NULL = no degradada.
    degraded_since              DATETIME     DEFAULT NULL,
    created_at                  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_stream_moderation_sessions_stream (stream_record_id),
    KEY idx_stream_moderation_sessions_status (status),
    KEY idx_stream_moderation_sessions_provider (provider),
    KEY idx_stream_moderation_sessions_started_at (started_at),
    KEY idx_stream_moderation_sessions_degraded_since (degraded_since),
    CONSTRAINT fk_stream_moderation_sessions_stream_record
        FOREIGN KEY (stream_record_id) REFERENCES stream_records (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_stream_moderation_sessions_provider
        CHECK (provider IN ('MOCK','SIGHTENGINE','HIVE','REKOGNITION')),
    CONSTRAINT chk_stream_moderation_sessions_status
        CHECK (status IN ('ACTIVE','STOPPED','ERROR','DEGRADED')),
    CONSTRAINT chk_stream_moderation_sessions_sampling_strategy
        CHECK (sampling_strategy IN ('INTERVAL','EVENT','HYBRID'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- ------------------------------------------------------------
-- Paso 3: stream_moderation_events
-- (idempotencia (provider, provider_event_id) calca kyc_webhook_events;
--  acepta tambien eventos sync sin provider_event_id por ahora -
--  MySQL UK ignora NULLs por lo que multiples filas sync con NULL
--  conviven sin chocar)
-- ------------------------------------------------------------
CREATE TABLE stream_moderation_events (
    id                            BIGINT       NOT NULL AUTO_INCREMENT,
    stream_moderation_session_id  BIGINT       NOT NULL,
    provider                      VARCHAR(20)  NOT NULL,
    provider_event_id             VARCHAR(150) DEFAULT NULL,
    event_type                    VARCHAR(40)  NOT NULL,
    -- NULL salvo para WEBHOOK_RECEIVED (aplica firma HMAC del vendor).
    is_signature_valid            BOOLEAN      DEFAULT NULL,
    is_processed                  BOOLEAN      NOT NULL DEFAULT FALSE,
    processing_error_message      VARCHAR(500) DEFAULT NULL,
    payload_json                  LONGTEXT     NOT NULL,
    received_at                   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at                  DATETIME     DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_stream_moderation_events_provider_event
        (provider, provider_event_id),
    KEY idx_stream_moderation_events_session (stream_moderation_session_id),
    KEY idx_stream_moderation_events_processed (is_processed),
    KEY idx_stream_moderation_events_processed_received_at
        (is_processed, received_at),
    KEY idx_stream_moderation_events_provider_received_at
        (provider, received_at),
    CONSTRAINT fk_stream_moderation_events_session
        FOREIGN KEY (stream_moderation_session_id)
        REFERENCES stream_moderation_sessions (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_stream_moderation_events_provider
        CHECK (provider IN ('MOCK','SIGHTENGINE','HIVE','REKOGNITION')),
    CONSTRAINT chk_stream_moderation_events_event_type
        CHECK (event_type IN
            ('VERDICT_RECEIVED','VERDICT_TIMEOUT','VERDICT_ERROR','WEBHOOK_RECEIVED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- ------------------------------------------------------------
-- Paso 4: stream_moderation_reviews
-- (cola humana priorizada; calca model_asset_reviews + extension de
--  category/severity/score/priority del frente moderacion. UK sobre
--  (provider, provider_event_id) coherente con events - ajuste F3.)
-- ------------------------------------------------------------
CREATE TABLE stream_moderation_reviews (
    id                            BIGINT       NOT NULL AUTO_INCREMENT,
    stream_record_id              BIGINT       NOT NULL,
    stream_moderation_session_id  BIGINT       NOT NULL,
    -- provider denormalizado para que la UK (provider, provider_event_id)
    -- pueda imponerse sin JOIN. La fila se inserta por el control plane
    -- al ingerir un verdict del vendor.
    provider                      VARCHAR(20)  NOT NULL,
    category                      VARCHAR(40)  NOT NULL,
    severity                      VARCHAR(10)  NOT NULL,
    score                         DECIMAL(5,2) NOT NULL,
    -- NULL si la review se crea sintetica (decision residual). MySQL UK
    -- ignora NULLs por lo que multiples sinteticas conviven sin chocar.
    provider_event_id             VARCHAR(150) DEFAULT NULL,
    -- Clave opaca a storage privado de evidencia (decision residual #10
    -- abierta). NULL en P1.1; el storage se decide en P1.2 o despues.
    evidence_ref                  VARCHAR(255) DEFAULT NULL,
    frame_timestamp               DATETIME     DEFAULT NULL,
    status                        VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    -- Derivada por StreamModerationActionService (P1.2): 1 = mas urgente.
    priority                      INT          NOT NULL DEFAULT 100,
    reviewer_id                   BIGINT       DEFAULT NULL,
    reviewed_at                   DATETIME     DEFAULT NULL,
    decision_code                 VARCHAR(50)  DEFAULT NULL,
    decision_note                 VARCHAR(500) DEFAULT NULL,
    created_at                    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_stream_moderation_reviews_provider_event
        (provider, provider_event_id),
    KEY idx_stream_moderation_reviews_status_priority
        (status, priority, created_at),
    KEY idx_stream_moderation_reviews_stream (stream_record_id),
    KEY idx_stream_moderation_reviews_session (stream_moderation_session_id),
    KEY idx_stream_moderation_reviews_severity_status (severity, status),
    KEY idx_stream_moderation_reviews_reviewer (reviewer_id),
    CONSTRAINT fk_stream_moderation_reviews_stream_record
        FOREIGN KEY (stream_record_id) REFERENCES stream_records (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_stream_moderation_reviews_session
        FOREIGN KEY (stream_moderation_session_id)
        REFERENCES stream_moderation_sessions (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_stream_moderation_reviews_reviewer
        FOREIGN KEY (reviewer_id) REFERENCES users (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_stream_moderation_reviews_provider
        CHECK (provider IN ('MOCK','SIGHTENGINE','HIVE','REKOGNITION')),
    CONSTRAINT chk_stream_moderation_reviews_status
        CHECK (status IN ('PENDING','IN_REVIEW','APPROVED','REJECTED','CANCELLED')),
    CONSTRAINT chk_stream_moderation_reviews_severity
        CHECK (severity IN ('GREEN','AMBER','RED','CRITICAL')),
    CONSTRAINT chk_stream_moderation_reviews_category
        CHECK (category IN ('NUDITY','WEAPONS','DRUGS','VIOLENCE','GORE',
                            'SELF_HARM','GAMBLING','OFFENSIVE_SYMBOLS',
                            'MINORS','OTHER'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- ------------------------------------------------------------
-- Paso 5: stream_moderation_attendance
-- (skeleton attendance log para defensa anti-chargeback - ADR-030;
--  el muestreo real se construye en Paquete 2/3. UK
--  (provider, provider_event_id) coherente con events / reviews.)
-- ------------------------------------------------------------
CREATE TABLE stream_moderation_attendance (
    id                   BIGINT       NOT NULL AUTO_INCREMENT,
    stream_record_id     BIGINT       NOT NULL,
    model_user_id        BIGINT       NOT NULL,
    present              BOOLEAN      NOT NULL,
    presence_score       DECIMAL(5,2) DEFAULT NULL,
    sampled_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    provider             VARCHAR(20)  NOT NULL,
    provider_event_id    VARCHAR(150) DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_stream_moderation_attendance_provider_event
        (provider, provider_event_id),
    KEY idx_stream_moderation_attendance_stream (stream_record_id),
    KEY idx_stream_moderation_attendance_model (model_user_id),
    KEY idx_stream_moderation_attendance_stream_sampled
        (stream_record_id, sampled_at),
    CONSTRAINT fk_stream_moderation_attendance_stream_record
        FOREIGN KEY (stream_record_id) REFERENCES stream_records (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_stream_moderation_attendance_model_user
        FOREIGN KEY (model_user_id) REFERENCES users (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_stream_moderation_attendance_provider
        CHECK (provider IN ('MOCK','SIGHTENGINE','HIVE','REKOGNITION'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
