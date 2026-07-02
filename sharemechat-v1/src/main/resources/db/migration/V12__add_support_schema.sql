-- Sub-paquete Chat Soporte LLM Fase B.1 (DEC-CS-1..18).
-- Cero cambio en tablas existentes salvo INSERT del bot user.

CREATE TABLE support_conversations (
    id                   BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id              BIGINT NOT NULL,
    started_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at             DATETIME NULL,
    resolution_status    VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    escalated_at         DATETIME NULL,
    escalation_reason    VARCHAR(500) NULL,
    escalated_by_llm     TINYINT(1) NOT NULL DEFAULT 0,
    reporter_ip_hash     VARCHAR(64) NULL,
    updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_support_conv_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT chk_support_conv_resolution CHECK
        (resolution_status IN ('OPEN','RESOLVED','ESCALATED','ABANDONED','RATE_LIMITED')),
    INDEX idx_support_conv_user (user_id, started_at DESC),
    INDEX idx_support_conv_status (resolution_status, started_at DESC)
);

CREATE TABLE support_messages (
    id                   BIGINT PRIMARY KEY AUTO_INCREMENT,
    conversation_id      BIGINT NOT NULL,
    sender               VARCHAR(10) NOT NULL,
    content              VARCHAR(4000) NOT NULL,
    tokens_input         INT NULL,
    tokens_output        INT NULL,
    cost_estimate_micros BIGINT NULL,
    llm_model            VARCHAR(50) NULL,
    llm_finish_reason    VARCHAR(50) NULL,
    created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_support_msg_conv FOREIGN KEY (conversation_id) REFERENCES support_conversations(id),
    CONSTRAINT chk_support_msg_sender CHECK
        (sender IN ('USER','LLM','HUMAN','SYSTEM')),
    INDEX idx_support_msg_conv (conversation_id, created_at ASC)
);

CREATE TABLE support_rate_limit_daily (
    user_id              BIGINT NOT NULL,
    usage_date           DATE NOT NULL,
    messages_count       INT NOT NULL DEFAULT 0,
    tokens_count         BIGINT NOT NULL DEFAULT 0,
    exceeded_at          DATETIME NULL,
    updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, usage_date),
    CONSTRAINT fk_support_rl_user FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_support_rl_date (usage_date)
);

-- Bot user SUPPORT_BOT (DEC-CS-9). Email + nickname consistente entre entornos.
-- Campos NOT NULL sin default: password (marca), user_type, is_active, confir_adult,
-- unsubscribe, account_status, risk_updated_at, updated_at.
-- No tiene sentido loguearse como bot: password es marca no funcional.
INSERT INTO users (
    nickname, email, password, role, ui_locale,
    user_type, is_active, confir_adult, unsubscribe,
    account_status, risk_updated_at, updated_at
) VALUES (
    'Soporte SharemeChat',
    'bot+support@sharemechat.com',
    '__NO_LOGIN__',
    'SUPPORT_BOT',
    'es',
    'BOT',
    1,
    1,
    0,
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
