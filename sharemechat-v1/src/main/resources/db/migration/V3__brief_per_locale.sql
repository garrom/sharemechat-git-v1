-- ============================================================
-- V3__brief_per_locale.sql -- brief pasa a campo per-locale (ADR-027)
-- ============================================================
-- Diagnostico del bug "brief no traducido en EN" durante el paquete
-- 10.A.7: el campo `brief` vivia en `content_articles` (shared) pero el
-- frontend publico lo mostraba como si fuera lingueistico. Decision
-- (ADR-027): mover brief a `content_article_translations` para que sea
-- per-locale como title, seo_title y meta_description.
--
-- Esta migracion:
--   1. Anade columna `brief TEXT NULL` a content_article_translations.
--   2. Hace backfill copiando el brief actual al row con locale='es'
--      (asume que los briefs existentes estan en espanol, que es el
--      locale base del pipeline editorial post-ADR-023).
--   3. Elimina columna `brief` de content_articles.
--
-- Tablas de versiones (`content_article_translation_versions`) NO se
-- tocan en este paquete (decision documentada en ADR-027): brief nunca
-- se ha snapshoteado en versiones y mantener simetria con el
-- comportamiento historico requiere refactor minimo. Si en el futuro
-- se quiere conservar traza historica del brief, una V4 lo anadira sin
-- romper esta.
--
-- Idempotencia: este script NO es idempotente. Una vez aplicado, el
-- DROP COLUMN content_articles.brief es destructivo. Flyway garantiza
-- que la migracion solo corre una vez.
--
-- Ventana de mantenimiento requerida: el backend debe estar parado
-- durante la aplicacion porque ddl-auto=validate fallara entre el
-- momento en que la columna `brief` sale de content_articles y el
-- momento en que el JAR refactorizado (10.A.8) arranque con las
-- entidades nuevas. Procedimiento operativo: paquete 10.A.11.
-- ============================================================

-- ------------------------------------------------------------
-- Paso 1: anadir columna brief a content_article_translations
-- ------------------------------------------------------------
ALTER TABLE content_article_translations
    ADD COLUMN brief TEXT NULL AFTER meta_description;

-- ------------------------------------------------------------
-- Paso 2: backfill desde content_articles.brief al locale ES
-- ------------------------------------------------------------
-- Solo poblar el locale ES: el brief actual esta escrito en espanol
-- por convencion del pipeline editorial. El locale EN queda NULL hasta
-- que el operador o el pipeline IA (paquete 10.A.9) lo rellenen.
UPDATE content_article_translations t
INNER JOIN content_articles a ON a.id = t.article_id
SET t.brief = a.brief
WHERE t.locale = 'es' AND a.brief IS NOT NULL;

-- ------------------------------------------------------------
-- Paso 3: eliminar columna brief de content_articles
-- ------------------------------------------------------------
ALTER TABLE content_articles
    DROP COLUMN brief;
