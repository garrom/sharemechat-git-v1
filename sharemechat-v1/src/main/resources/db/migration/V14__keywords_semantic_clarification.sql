-- ============================================================
-- V14__keywords_semantic_clarification.sql -- ADR-045 D10
-- ============================================================
-- Migracion cosmetica: solo actualiza los COMMENT SQL de dos
-- columnas para reflejar la nueva semantica introducida por
-- ADR-045 (keywords SEO per-locale editables por el operador).
-- Sin cambios estructurales; los datos existentes son
-- compatibles.
--
--   1. content_article_translations.target_keywords deja de
--      ser output-only del pipeline IA y pasa a ser input del
--      operador + enriquecimiento IA via merge. El array JSON
--      sigue con el mismo formato {term, type, search_intent_match},
--      pero ahora puede escribirlo el operador antes del run;
--      applyBilingual aplica reglas de merge D4 del ADR-045.
--
--   2. content_articles.keywords queda marcado como legacy.
--      Sigue funcional en 2A por retro-compatibilidad con la UI
--      admin actual (2B retira el input del frontend). Una
--      migracion posterior lo eliminara con backfill retroactivo.
-- ============================================================

ALTER TABLE content_article_translations
    MODIFY COLUMN target_keywords JSON NULL
    COMMENT 'Array JSON de {term, type, search_intent_match} per-locale. Input operador (primary + secondaries) + enriquecimiento IA con merge, ADR-045 D1/D4. Exactamente 1 type=primary; 0..5 type=secondary.';

ALTER TABLE content_articles
    MODIFY COLUMN keywords JSON NULL
    COMMENT 'LEGACY (ADR-045 D5): sustituido por content_article_translations.target_keywords per-locale. Sigue operativo por compat 2A; retirada planificada para ADR futuro con backfill.';
