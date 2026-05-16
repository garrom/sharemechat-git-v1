-- ============================================================
-- V2__cms_v2_schema.sql -- CMS rediseño bilingüe ES+EN (ADR-025)
-- ============================================================
-- Reemplaza por construccion al schema previo (V20260501 +
-- V20260508, ahora archivados en
-- docs/_archive/db-manual-pre-flyway/).
--
-- Modelo (ver ADR-025 para racional completo):
--   * content_articles               -- articulo logico, invariante por idioma.
--   * content_article_translations   -- cara per-idioma (1:N article→translations).
--   * content_article_versions       -- snapshot del articulo logico en una transicion.
--   * content_article_translation_versions -- snapshot per-idioma en esa version.
--   * content_generation_runs        -- runs IA, article_id apunta al logico.
--   * content_review_events          -- auditoria editorial, article_id idem.
--
-- Idempotencia: DROP TABLE IF EXISTS en orden inverso de FK. Re-ejecutar
-- V2 sobre TEST limpia y reconstruye sin error. SET FOREIGN_KEY_CHECKS
-- se desactiva durante los drops para evitar fallos por orden de FK.
--
-- Permisos y rol EDITOR: V20260501 los sembraba con INSERT IGNORE.
-- Esas filas viven en `permissions`, `backoffice_roles`, `role_permissions`
-- (fuera del dominio CMS) y sobreviven al drop de las 4 tablas content_*.
-- V2 NO los re-siembra; se asumen presentes desde el baseline.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS content_review_events;
DROP TABLE IF EXISTS content_article_translation_versions;
DROP TABLE IF EXISTS content_article_versions;
DROP TABLE IF EXISTS content_article_translations;
DROP TABLE IF EXISTS content_generation_runs;
DROP TABLE IF EXISTS content_articles;

SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------
-- content_articles -- articulo logico
-- ------------------------------------------------------------
CREATE TABLE content_articles (
    id BIGINT NOT NULL AUTO_INCREMENT,
    hero_image_url VARCHAR(500) NULL,
    category VARCHAR(80) NULL,
    keywords JSON NULL,
    brief TEXT NULL,
    state VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    ai_assisted TINYINT(1) NOT NULL DEFAULT 0,
    disclosure_required TINYINT(1) NOT NULL DEFAULT 0,
    published_at DATETIME NULL,
    scheduled_for DATETIME NULL,
    retracted_at DATETIME NULL,
    current_version_id BIGINT NULL,
    responsible_editor_user_id BIGINT NULL,
    created_by_user_id BIGINT NOT NULL,
    updated_by_user_id BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_content_articles_state (state),
    CONSTRAINT chk_content_articles_state CHECK (
        state IN ('DRAFT','IN_REVIEW','PUBLISHED','RETRACTED','SCHEDULED')
    ),
    CONSTRAINT fk_content_articles_responsible
        FOREIGN KEY (responsible_editor_user_id) REFERENCES users(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_content_articles_creator
        FOREIGN KEY (created_by_user_id) REFERENCES users(id),
    CONSTRAINT fk_content_articles_updater
        FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
);

-- ------------------------------------------------------------
-- content_article_translations -- cara per-idioma
-- ------------------------------------------------------------
CREATE TABLE content_article_translations (
    id BIGINT NOT NULL AUTO_INCREMENT,
    article_id BIGINT NOT NULL,
    locale VARCHAR(10) NOT NULL,
    slug VARCHAR(160) NOT NULL,
    title VARCHAR(255) NOT NULL,
    seo_title VARCHAR(60) NULL,
    meta_description VARCHAR(160) NULL,
    body_s3_key VARCHAR(500) NULL,
    body_content_hash VARCHAR(64) NULL,
    target_keywords JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_content_article_translations_article_locale (article_id, locale),
    UNIQUE KEY uq_content_article_translations_slug_locale (slug, locale),
    KEY idx_content_article_translations_locale (locale),
    CONSTRAINT fk_content_article_translations_article
        FOREIGN KEY (article_id) REFERENCES content_articles(id)
        ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- content_article_versions -- snapshot del articulo logico
-- ------------------------------------------------------------
CREATE TABLE content_article_versions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    article_id BIGINT NOT NULL,
    version_number INT NOT NULL,
    source_run_id BIGINT NULL,
    created_by_user_id BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_content_article_versions_article_n (article_id, version_number),
    CONSTRAINT fk_content_article_versions_article
        FOREIGN KEY (article_id) REFERENCES content_articles(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_content_article_versions_creator
        FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

-- ------------------------------------------------------------
-- content_article_translation_versions -- snapshot per-idioma
-- ------------------------------------------------------------
CREATE TABLE content_article_translation_versions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    version_id BIGINT NOT NULL,
    locale VARCHAR(10) NOT NULL,
    body_s3_key VARCHAR(500) NOT NULL,
    body_content_hash VARCHAR(64) NOT NULL,
    slug VARCHAR(160) NOT NULL,
    title VARCHAR(255) NOT NULL,
    seo_title VARCHAR(60) NULL,
    meta_description VARCHAR(160) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_catv_version_locale (version_id, locale),
    CONSTRAINT fk_catv_version
        FOREIGN KEY (version_id) REFERENCES content_article_versions(id)
        ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- FK content_articles.current_version_id (anadida tras crear versions)
-- ------------------------------------------------------------
ALTER TABLE content_articles
    ADD CONSTRAINT fk_content_articles_current_version
        FOREIGN KEY (current_version_id) REFERENCES content_article_versions(id)
        ON DELETE SET NULL;

-- ------------------------------------------------------------
-- content_generation_runs -- runs IA
-- ------------------------------------------------------------
CREATE TABLE content_generation_runs (
    id BIGINT NOT NULL AUTO_INCREMENT,
    article_id BIGINT NOT NULL,
    model_provider VARCHAR(40) NOT NULL,
    model_id VARCHAR(80) NOT NULL,
    model_version VARCHAR(80) NULL,
    prompt_template_id VARCHAR(80) NULL,
    prompt_s3_key VARCHAR(500) NULL,
    prompt_hash VARCHAR(64) NULL,
    output_s3_key VARCHAR(500) NULL,
    output_hash VARCHAR(64) NULL,
    output_validated TINYINT(1) NOT NULL DEFAULT 0,
    tokens_input INT NULL,
    tokens_output INT NULL,
    estimated_cost_eur DECIMAL(10,4) NULL,
    triggered_by_user_id BIGINT NULL,
    mode VARCHAR(30) NOT NULL DEFAULT 'MANUAL_STRUCTURED',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_content_generation_runs_article (article_id),
    KEY idx_content_generation_runs_user (triggered_by_user_id),
    CONSTRAINT chk_content_generation_runs_mode CHECK (
        mode IN ('MANUAL_STRUCTURED','API_HYBRID','API_AUTO')
    ),
    CONSTRAINT chk_content_generation_runs_status CHECK (
        status IN ('PENDING','VALIDATED','REJECTED','FAILED')
    ),
    CONSTRAINT fk_content_generation_runs_article
        FOREIGN KEY (article_id) REFERENCES content_articles(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_content_generation_runs_user
        FOREIGN KEY (triggered_by_user_id) REFERENCES users(id)
        ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- FK content_article_versions.source_run_id (anadida tras crear runs)
-- ------------------------------------------------------------
ALTER TABLE content_article_versions
    ADD CONSTRAINT fk_content_article_versions_run
        FOREIGN KEY (source_run_id) REFERENCES content_generation_runs(id)
        ON DELETE SET NULL;

-- ------------------------------------------------------------
-- content_review_events -- auditoria editorial
-- ------------------------------------------------------------
CREATE TABLE content_review_events (
    id BIGINT NOT NULL AUTO_INCREMENT,
    article_id BIGINT NOT NULL,
    version_id BIGINT NULL,
    event_type VARCHAR(40) NOT NULL,
    actor_user_id BIGINT NOT NULL,
    payload_json TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_content_review_events_article_created (article_id, created_at),
    KEY idx_content_review_events_actor (actor_user_id),
    CONSTRAINT chk_content_review_events_type CHECK (
        event_type IN ('EDIT_APPLIED','DRAFT_REQUESTED','PUBLISHED',
                       'RETRACTED','SCHEDULED','DISCLOSURE_OVERRIDE')
    ),
    CONSTRAINT fk_content_review_events_article
        FOREIGN KEY (article_id) REFERENCES content_articles(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_content_review_events_version
        FOREIGN KEY (version_id) REFERENCES content_article_versions(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_content_review_events_actor
        FOREIGN KEY (actor_user_id) REFERENCES users(id)
        ON DELETE RESTRICT
);
