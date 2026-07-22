-- V32: flag is_trial en stream_moderation_sessions. Se hidrata al crear
-- la sesion de moderacion desde stream_records.is_trial (V31). Sirve al
-- ModerationCategoryMapper para aplicar umbrales locales estrictos sobre
-- los scores crudos cuando es trial, ignorando summary.action del
-- workflow Sightengine (frente trial-sfw Bloque 2, Via 1).

ALTER TABLE stream_moderation_sessions
    ADD COLUMN is_trial TINYINT(1) NOT NULL DEFAULT 0
        COMMENT 'true si la sesion es de un trial shadow record. Activa umbrales estrictos locales del mapper (moderation.thresholds.trial.*).';
