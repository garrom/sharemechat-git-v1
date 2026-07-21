-- V29: contador de operations Sightengine consumidas por sesion.
-- Base del bloque 5 del frente "prueba gratis SFW" (ADR-037 Fase 5).
-- La suma se hace por sesion (una fila = un stream); la agregacion
-- mensual y diaria vive en el job de alerta y en el widget admin de
-- pasos posteriores. MOCK deja el default 0 (no cuenta contra cupo).
-- Indice sobre created_at para que las agregaciones por rango temporal
-- (mes actual, dia actual, ultimos N dias) no escaneen tabla completa
-- cuando el volumen crezca.

ALTER TABLE stream_moderation_sessions
    ADD COLUMN operations_consumed BIGINT NOT NULL DEFAULT 0
        COMMENT 'Suma de operations Sightengine consumidas por esta sesion. MOCK deja 0.';

CREATE INDEX idx_stream_moderation_sessions_created_at
    ON stream_moderation_sessions (created_at);
