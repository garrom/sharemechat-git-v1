-- ============================================================
-- V20260501 -- CMS Phase 1 schema (ADR-010, Fase 1)
-- ============================================================
-- Crea las cuatro tablas de contenido editorial, registra los
-- permisos CONTENT.* y el rol backoffice EDITOR.
-- Fase 1 solo opera content_articles; las otras tres tablas
-- quedan creadas pero sin datos hasta fases siguientes.
-- ============================================================

-- ------------------------------------------------------------
-- content_articles
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_articles (
    id BIGINT NOT NULL AUTO_INCREMENT,
    slug VARCHAR(160) NOT NULL,
    locale VARCHAR(10) NOT NULL DEFAULT 'es',
    parent_article_id BIGINT NULL,
    state VARCHAR(30) NOT NULL DEFAULT 'IDEA',
    title VARCHAR(255) NOT NULL,
    brief TEXT NULL,
    category VARCHAR(80) NULL,
    keywords JSON NULL,
    responsible_editor_user_id BIGINT NULL,
    current_version_id BIGINT NULL,
    body_s3_key VARCHAR(500) NULL,
    body_content_hash VARCHAR(64) NULL,
    published_at DATETIME NULL,
    scheduled_for DATETIME NULL,
    retracted_at DATETIME NULL,
    ai_assisted TINYINT(1) NOT NULL DEFAULT 0,
    disclosure_required TINYINT(1) NOT NULL DEFAULT 0,
    created_by_user_id BIGINT NULL,
    updated_by_user_id BIGINT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_content_articles_slug_locale (slug, locale),
    KEY idx_content_articles_state (state),
    KEY idx_content_articles_locale (locale),
    KEY idx_content_articles_parent (parent_article_id),
    KEY idx_content_articles_responsible (responsible_editor_user_id),
    CONSTRAINT chk_content_articles_state CHECK (
        state IN ('IDEA','OUTLINE_READY','DRAFT_GENERATED','IN_REVIEW',
                  'APPROVED','SCHEDULED','PUBLISHED','RETRACTED')
    ),
    CONSTRAINT fk_content_articles_parent
        FOREIGN KEY (parent_article_id) REFERENCES content_articles(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_content_articles_editor
        FOREIGN KEY (responsible_editor_user_id) REFERENCES users(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_content_articles_creator
        FOREIGN KEY (created_by_user_id) REFERENCES users(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_content_articles_updater
        FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
        ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- content_article_versions
-- (creada vacia en Fase 1; se rellena desde Fase 2)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_article_versions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    article_id BIGINT NOT NULL,
    version_number INT NOT NULL,
    body_s3_key VARCHAR(500) NOT NULL,
    body_content_hash VARCHAR(64) NOT NULL,
    source_run_id BIGINT NULL,
    created_by_user_id BIGINT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_content_article_versions_article_n (article_id, version_number),
    KEY idx_content_article_versions_run (source_run_id),
    CONSTRAINT fk_content_article_versions_article
        FOREIGN KEY (article_id) REFERENCES content_articles(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_content_article_versions_creator
        FOREIGN KEY (created_by_user_id) REFERENCES users(id)
        ON DELETE SET NULL
);

ALTER TABLE content_articles
    ADD CONSTRAINT fk_content_articles_current_version
        FOREIGN KEY (current_version_id) REFERENCES content_article_versions(id)
        ON DELETE SET NULL;

-- ------------------------------------------------------------
-- content_generation_runs
-- (creada vacia en Fase 1; se rellena desde Fase 3)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_generation_runs (
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

ALTER TABLE content_article_versions
    ADD CONSTRAINT fk_content_article_versions_run
        FOREIGN KEY (source_run_id) REFERENCES content_generation_runs(id)
        ON DELETE SET NULL;

-- ------------------------------------------------------------
-- content_review_events
-- (creada vacia en Fase 1; se rellena desde Fase 2)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_review_events (
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
        event_type IN ('OUTLINE_APPROVED','DRAFT_REQUESTED','EDIT_APPLIED',
                       'REVIEW_APPROVED','REVIEW_REJECTED','PUBLISHED',
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

-- ============================================================
-- Permisos CMS y rol EDITOR (idempotente)
-- ============================================================

INSERT IGNORE INTO permissions (code) VALUES
    ('CONTENT.VIEW'),
    ('CONTENT.EDIT'),
    ('CONTENT.REVIEW'),
    ('CONTENT.PUBLISH');

INSERT IGNORE INTO backoffice_roles (code) VALUES
    ('EDITOR');

INSERT INTO role_permissions (role_id, permission_id)
SELECT br.id, p.id
FROM backoffice_roles br
JOIN permissions p ON UPPER(p.code) IN (
    'CONTENT.VIEW','CONTENT.EDIT','CONTENT.REVIEW','CONTENT.PUBLISH'
)
WHERE UPPER(br.code) = 'ADMIN'
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = br.id AND rp.permission_id = p.id
  );

INSERT INTO role_permissions (role_id, permission_id)
SELECT br.id, p.id
FROM backoffice_roles br
JOIN permissions p ON UPPER(p.code) IN ('CONTENT.VIEW','CONTENT.EDIT')
WHERE UPPER(br.code) = 'EDITOR'
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = br.id AND rp.permission_id = p.id
  );
