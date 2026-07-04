-- ADR-044: Base de conocimiento del Agente IA de soporte externalizada a MySQL.
-- Fase 1.A: schema únicamente. Población posterior vía endpoint admin
-- POST /api/admin/knowledge-base/seed-from-jar (idempotente, INSERT IGNORE).
-- Coexiste con la BdC del JAR; Fase 1.C sustituirá la lectura, Fase 1.D borrará los .md.

CREATE TABLE support_bot_prompts (
    id           BIGINT PRIMARY KEY AUTO_INCREMENT,
    case_key     VARCHAR(120) NOT NULL,
    role         VARCHAR(20)  NOT NULL DEFAULT 'BOTH',
    content      LONGTEXT     NOT NULL,
    description  VARCHAR(500) NULL,
    active       TINYINT(1)   NOT NULL DEFAULT 1,
    version      INT          NOT NULL DEFAULT 1,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_support_bot_prompts_case_key UNIQUE (case_key),
    CONSTRAINT chk_support_bot_prompts_role CHECK (role IN ('CLIENT','MODEL','BOTH')),
    INDEX idx_support_bot_prompts_role_active (role, active)
);
