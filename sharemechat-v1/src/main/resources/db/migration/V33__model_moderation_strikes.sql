-- V33: registro de infracciones automaticas confirmadas por el pipeline
-- de moderacion IA sobre streams trial (ADR-037 frente trial-sfw Bloque 3).
-- Solo severity=CRITICAL en sesiones is_trial=true genera strike. Maximo
-- 1 strike por stream_moderation_session (UK stream_moderation_session_id)
-- para evitar castigo doble si aparecen varios frames malos consecutivos
-- dentro del mismo trial (~50s max).
--
-- El contador de strikes activos por modelo (ventana 30 dias) se calcula
-- desde este historial: WHERE model_user_id=X AND created_at >= NOW() -
-- INTERVAL 30 DAY. Los strikes viejos NO se borran (auditoria + panel
-- Bloque 4); solo dejan de sumar al contador tras 30 dias.

CREATE TABLE model_moderation_strikes (
    id                              BIGINT       AUTO_INCREMENT PRIMARY KEY,
    model_user_id                   BIGINT       NOT NULL,
    stream_moderation_session_id    BIGINT       NOT NULL,
    severity                        VARCHAR(20)  NOT NULL,
    category                        VARCHAR(50)  NOT NULL,
    is_trial                        TINYINT(1)   NOT NULL DEFAULT 1,
    created_at                      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_model_moderation_strikes_session
        UNIQUE (stream_moderation_session_id),
    INDEX idx_model_moderation_strikes_model_created (model_user_id, created_at)
);
