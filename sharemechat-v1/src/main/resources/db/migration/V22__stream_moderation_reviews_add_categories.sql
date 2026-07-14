-- V22__stream_moderation_reviews_add_categories.sql
--
-- ADR-050 Fase C + Fase D FIX: el CHECK constraint chk_stream_moderation_reviews_category
-- creado en V10 no incluia las categorias nuevas OUT_OF_SCENE (Fase C) ni
-- FROZEN_STREAM (Fase D). Cuando el pipeline detectaba OUT_OF_SCENE o
-- FROZEN_STREAM y intentaba persistir la review, MySQL rechazaba el INSERT
-- con "Check constraint 'chk_stream_moderation_reviews_category' is
-- violated" -> el auto-cut nunca se disparaba.
--
-- Bug detectado en test manual del operador (2026-07-15) tras 11 detecciones
-- consecutivas de FROZEN_STREAM sin efecto: la sesion no se cortaba.
--
-- Fix: dropear el CHECK viejo y recrearlo con la lista actualizada.

ALTER TABLE stream_moderation_reviews
    DROP CHECK chk_stream_moderation_reviews_category;

ALTER TABLE stream_moderation_reviews
    ADD CONSTRAINT chk_stream_moderation_reviews_category CHECK (
        category IN (
            'NUDITY','WEAPONS','DRUGS','VIOLENCE','GORE',
            'SELF_HARM','GAMBLING','OFFENSIVE_SYMBOLS',
            'MINORS','OTHER',
            'OUT_OF_SCENE','FROZEN_STREAM'
        )
    );
