-- ============================================================
-- V20260508 -- CMS workflow simplification (ADR-016)
-- ============================================================
-- Reescribe el workflow editorial de seis estados (IDEA → OUTLINE_READY
-- → DRAFT_GENERATED → IN_REVIEW → APPROVED → PUBLISHED) a cuatro
-- (DRAFT → IN_REVIEW → PUBLISHED → RETRACTED). SCHEDULED se mantiene
-- en el CHECK aunque siga inalcanzable a nivel de service (D1, D5).
--
-- Acciones en orden:
--  1) Borrar cascada de filas de articulos en estados ya obsoletos
--     (IDEA, OUTLINE_READY, DRAFT_GENERATED, IN_REVIEW, APPROVED).
--     Decision D4 del ADR-016: trabajo descartable. Solo articulos
--     PUBLISHED y RETRACTED sobreviven.
--  2) Reescribir CHECK de content_articles.state.
--  3) Reescribir CHECK de content_review_events.event_type.
--  4) Cambiar el DEFAULT de content_articles.state a 'DRAFT' para que
--     futuros INSERTs sin state explicito no fallen el CHECK.
--
-- Atencion: NO es reversible. Los articulos no publicados se pierden.
-- Los objetos S3 asociados (draft.md, v{n}.md, runs/...) NO se borran
-- aqui; quedan huerfanos. Limpieza S3 = tarea operativa posterior con
-- AWS CLI.
--
-- Flavor: MySQL 8 (sintaxis ALTER TABLE ... DROP CHECK / ADD CONSTRAINT).
-- ============================================================

-- ------------------------------------------------------------
-- 1) Romper la auto-FK content_articles.current_version_id antes
--    de borrar versiones, para evitar carreras del SET NULL en
--    cascada cuando el articulo padre tambien va a desaparecer.
-- ------------------------------------------------------------
UPDATE content_articles
   SET current_version_id = NULL
 WHERE state IN ('IDEA','OUTLINE_READY','DRAFT_GENERATED','IN_REVIEW','APPROVED');

-- ------------------------------------------------------------
-- 2) Borrar dependencias en orden estricto (aunque las FKs sean
--    ON DELETE CASCADE, se hace explicito para auditabilidad).
-- ------------------------------------------------------------
DELETE FROM content_review_events
 WHERE article_id IN (
       SELECT id FROM (
           SELECT id FROM content_articles
            WHERE state IN ('IDEA','OUTLINE_READY','DRAFT_GENERATED','IN_REVIEW','APPROVED')
       ) AS sub_re
 );

DELETE FROM content_generation_runs
 WHERE article_id IN (
       SELECT id FROM (
           SELECT id FROM content_articles
            WHERE state IN ('IDEA','OUTLINE_READY','DRAFT_GENERATED','IN_REVIEW','APPROVED')
       ) AS sub_gr
 );

DELETE FROM content_article_versions
 WHERE article_id IN (
       SELECT id FROM (
           SELECT id FROM content_articles
            WHERE state IN ('IDEA','OUTLINE_READY','DRAFT_GENERATED','IN_REVIEW','APPROVED')
       ) AS sub_av
 );

-- ------------------------------------------------------------
-- 3) Borrar los articulos no publicados.
-- ------------------------------------------------------------
DELETE FROM content_articles
 WHERE state IN ('IDEA','OUTLINE_READY','DRAFT_GENERATED','IN_REVIEW','APPROVED');

-- ------------------------------------------------------------
-- 4) Reescribir CHECK de content_articles.state.
--    Nombre original (V20260501): chk_content_articles_state.
-- ------------------------------------------------------------
ALTER TABLE content_articles
    DROP CHECK chk_content_articles_state;

ALTER TABLE content_articles
    ADD CONSTRAINT chk_content_articles_state CHECK (
        state IN ('DRAFT','IN_REVIEW','PUBLISHED','RETRACTED','SCHEDULED')
    );

-- ------------------------------------------------------------
-- 5) Cambiar el DEFAULT de la columna state.
--    Antes: 'IDEA'. Ahora: 'DRAFT'. Sin esto, cualquier INSERT
--    que omita state fallaria el CHECK. La entidad JPA fija el
--    estado explicitamente, asi que en el flujo normal este
--    DEFAULT solo aplica a inserts manuales o de tooling.
-- ------------------------------------------------------------
ALTER TABLE content_articles
    MODIFY COLUMN state VARCHAR(30) NOT NULL DEFAULT 'DRAFT';

-- ------------------------------------------------------------
-- 6) Reescribir CHECK de content_review_events.event_type.
--    Nombre original (V20260501): chk_content_review_events_type.
--
--    EDIT_APPLIED se conserva: la service sigue emitiendolo en
--    cada save de metadata/body y en cada apply de draft IA. Si
--    se elimina aqui, todos los saves de articulos editables
--    rompen con CHECK constraint failed. Decision propia (no
--    explicita en el listado del prompt; el listado parece
--    omitirlo por descuido).
--
--    OUTLINE_APPROVED, REVIEW_APPROVED, REVIEW_REJECTED: eliminados.
--    Las filas historicas con esos event_types pertenecian a
--    articulos no publicados ya borrados en pasos 2-3, asi que
--    no quedan registros incompatibles con la nueva constraint.
-- ------------------------------------------------------------
ALTER TABLE content_review_events
    DROP CHECK chk_content_review_events_type;

ALTER TABLE content_review_events
    ADD CONSTRAINT chk_content_review_events_type CHECK (
        event_type IN ('EDIT_APPLIED','DRAFT_REQUESTED','PUBLISHED',
                       'RETRACTED','SCHEDULED','DISCLOSURE_OVERRIDE')
    );
