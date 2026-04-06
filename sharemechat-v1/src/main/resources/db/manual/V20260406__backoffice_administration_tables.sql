CREATE TABLE IF NOT EXISTS backoffice_user_access (
    user_id BIGINT NOT NULL PRIMARY KEY,
    active TINYINT(1) NOT NULL DEFAULT 1,
    updated_by_user_id BIGINT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_backoffice_user_access_updated_by (updated_by_user_id),
    CONSTRAINT fk_backoffice_user_access_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_backoffice_user_access_updated_by
        FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS backoffice_access_audit_log (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    target_user_id BIGINT NOT NULL,
    actor_user_id BIGINT NULL,
    action VARCHAR(60) NOT NULL,
    summary TEXT NULL,
    payload_json TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_backoffice_access_audit_target_created (target_user_id, created_at),
    KEY idx_backoffice_access_audit_actor_created (actor_user_id, created_at),
    CONSTRAINT fk_backoffice_access_audit_target_user
        FOREIGN KEY (target_user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_backoffice_access_audit_actor_user
        FOREIGN KEY (actor_user_id) REFERENCES users(id)
        ON DELETE SET NULL
);
