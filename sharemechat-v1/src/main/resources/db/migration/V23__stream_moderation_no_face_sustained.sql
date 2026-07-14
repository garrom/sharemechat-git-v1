-- V23__stream_moderation_no_face_sustained.sql
--
-- ADR-050 Fase E (deuda #D-33): auto-cut cuando N ticks consecutivos
-- sin cara detectada. Complementa Fase C (out-of-scene con cara) y
-- Fase D (frame congelado con hash) para cubrir el hueco:
--   - Modelo se ausenta (cámara sin sujeto).
--   - Cámara tapada por objeto (sin cara pero con imagen variable).
--   - Contraluz extremo o lente oscura permanente.
--
-- Diseño: contador consecutive_no_face_frames en la misma tabla que ya
-- lleva los contadores de FROZEN (V21). Reutiliza el mismo path de
-- enforcement (categoria + severity + auto-cut) que OUT_OF_SCENE y
-- FROZEN_STREAM.
--
-- Umbral default: 3 (property moderation.presence.no-face-max-consecutive)
-- Con cadencia 60s = ~3 min sin cara antes de cortar.

ALTER TABLE stream_moderation_sessions
    ADD COLUMN consecutive_no_face_frames INT NOT NULL DEFAULT 0
        COMMENT 'ADR-050 Fase E (#D-33): contador de frames consecutivos sin cara detectada. Se resetea al detectar cara.';

-- Actualizar CHECK de category en stream_moderation_reviews para
-- incluir NO_FACE_SUSTAINED (los anteriores ya estaban en V22).
ALTER TABLE stream_moderation_reviews
    DROP CHECK chk_stream_moderation_reviews_category;

ALTER TABLE stream_moderation_reviews
    ADD CONSTRAINT chk_stream_moderation_reviews_category CHECK (
        category IN (
            'NUDITY','WEAPONS','DRUGS','VIOLENCE','GORE',
            'SELF_HARM','GAMBLING','OFFENSIVE_SYMBOLS',
            'MINORS','OTHER',
            'OUT_OF_SCENE','FROZEN_STREAM','NO_FACE_SUSTAINED'
        )
    );
