-- Frente B.3.1 - Panel Soporte Humano del Agente IA (ADR-046).
-- Introduce identidad de servicio (backoffice_agent_profile) desacoplada del user
-- real, tabla puente N:N para grants, columnas de asignacion humana en
-- support_conversations y de autoria humana en support_messages.
--
-- Decisiones estructurales:
-- - Profile no tiene owner unico (user_id NULLABLE rechazado por ambiguo).
--   Los grants viven en tabla puente para admitir turnos rotativos (Decision B).
-- - assigned_agent_id y assigned_profile_id coacoplados via CHECK bi-columna:
--   siempre ambos NULL o ambos NOT NULL.
-- - HUMAN_HANDLING coexiste con ESCALATED, no lo sustituye. Un caso puede estar
--   ESCALATED sin claim, o HUMAN_HANDLING con claim activo.
-- - display_name UNIQUE global (no parcial por active). Renombrar profiles
--   archivadas ("Pepito (legacy)") si se quiere reusar el nombre.

CREATE TABLE backoffice_agent_profile (
    id            BIGINT       PRIMARY KEY AUTO_INCREMENT,
    display_name  VARCHAR(80)  NOT NULL,
    active        TINYINT(1)   NOT NULL DEFAULT 1,
    category      VARCHAR(40)  NULL,
    created_by    BIGINT       NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uk_bap_display_name UNIQUE (display_name),
    CONSTRAINT fk_bap_created_by
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE backoffice_agent_profile_grant (
    user_id      BIGINT      NOT NULL,
    profile_id   BIGINT      NOT NULL,
    active       TINYINT(1)  NOT NULL DEFAULT 1,
    granted_by   BIGINT      NULL,
    granted_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, profile_id),
    CONSTRAINT fk_bapg_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_bapg_profile
        FOREIGN KEY (profile_id) REFERENCES backoffice_agent_profile(id) ON DELETE CASCADE,
    CONSTRAINT fk_bapg_granted_by
        FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_bapg_profile_active (profile_id, active),
    INDEX idx_bapg_user_active (user_id, active)
);

-- Ampliar CHECK de resolution_status para admitir HUMAN_HANDLING sin perder los
-- valores anteriores. DROP + ADD porque MySQL no permite modificar CHECK in place.
ALTER TABLE support_conversations
    DROP CHECK chk_support_conv_resolution;

ALTER TABLE support_conversations
    ADD CONSTRAINT chk_support_conv_resolution CHECK
        (resolution_status IN ('OPEN','RESOLVED','ESCALATED','ABANDONED','RATE_LIMITED','HUMAN_HANDLING'));

-- Columnas de asignacion humana. FK con ON DELETE SET NULL para no romper el
-- historial de la conversacion si un admin o profile se elimina fisicamente.
ALTER TABLE support_conversations
    ADD COLUMN assigned_agent_id   BIGINT   NULL,
    ADD COLUMN assigned_at         DATETIME NULL,
    ADD COLUMN assigned_profile_id BIGINT   NULL;

ALTER TABLE support_conversations
    ADD CONSTRAINT fk_support_conv_assigned_agent
        FOREIGN KEY (assigned_agent_id) REFERENCES users(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_support_conv_assigned_profile
        FOREIGN KEY (assigned_profile_id) REFERENCES backoffice_agent_profile(id) ON DELETE SET NULL,
    ADD CONSTRAINT chk_support_conv_assign_bicolumn CHECK
        ((assigned_agent_id IS NULL AND assigned_profile_id IS NULL)
         OR (assigned_agent_id IS NOT NULL AND assigned_profile_id IS NOT NULL));

CREATE INDEX idx_support_conv_assigned_status
    ON support_conversations (assigned_agent_id, resolution_status);

-- Columnas de autoria humana en support_messages. Poblados unicamente cuando
-- sender='HUMAN'. Para sender USER/LLM/SYSTEM permanecen NULL.
ALTER TABLE support_messages
    ADD COLUMN sent_by_user_id    BIGINT NULL,
    ADD COLUMN sent_by_profile_id BIGINT NULL;

ALTER TABLE support_messages
    ADD CONSTRAINT fk_support_msg_sent_by_user
        FOREIGN KEY (sent_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_support_msg_sent_by_profile
        FOREIGN KEY (sent_by_profile_id) REFERENCES backoffice_agent_profile(id) ON DELETE SET NULL;

CREATE INDEX idx_support_msg_sent_by_user
    ON support_messages (sent_by_user_id);
