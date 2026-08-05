-- V47 — tabla oauth_accounts para login federado (Sign in with Google, etc.)
--
-- Contexto: implementacion de "Sign in with Google" para el flujo CLIENT en
-- soft-launch (Fase 1). Tabla generica multi-provider desde el origen para
-- soportar future providers (Apple, Twitter/X) sin cambios de schema.
--
-- Un `user` puede tener 0..N `oauth_accounts` (por ejemplo: mismo user
-- vinculado a Google y a Apple). El par (provider, provider_user_id) es
-- unico globalmente. Los campos email_at_signup, google_hd y picture_url
-- se congelan en el signup para auditoria; el email vivo del user se
-- mantiene en users.email.
--
-- picture_url es opcional (Google puede o no devolverla segun scopes y
-- privacidad del user); se guarda como referencia pero NO se sirve
-- publicamente sin re-verificacion.

CREATE TABLE oauth_accounts (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    provider VARCHAR(20) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    email_at_signup VARCHAR(255) NOT NULL,
    google_hd VARCHAR(128) NULL,
    picture_url VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME NULL,
    revoked_at DATETIME NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_oauth_accounts_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_oauth_provider_sub UNIQUE (provider, provider_user_id),
    CONSTRAINT chk_oauth_provider CHECK (provider IN ('google', 'apple', 'twitter')),
    INDEX idx_oauth_user (user_id),
    INDEX idx_oauth_email_at_signup (email_at_signup)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
