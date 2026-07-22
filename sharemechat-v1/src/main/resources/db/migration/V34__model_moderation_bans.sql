-- V34: bans emitidos automaticamente al acumular strikes. Escalada
-- (ADR-037 frente trial-sfw Bloque 3): 15 min -> 30 min -> 1 h ->
-- 6 h -> 24 h + revision humana (5o strike+). El strike_count_at_ban
-- guarda el ordinal (dentro de la ventana 30 dias) que disparo el ban,
-- para poder auditar decisiones y reproducir la escalada. requires_manual_review
-- se marca true cuando strike_count_at_ban >= 5.
--
-- El estado "modelo actualmente baneada de streaming" se refleja en
-- models.streaming_banned_until (V35), que es lo que el matching gate
-- consulta en caliente. Esta tabla es el historial completo (audit trail)
-- + fuente para el panel del Bloque 4.

CREATE TABLE model_moderation_bans (
    id                        BIGINT       AUTO_INCREMENT PRIMARY KEY,
    model_user_id             BIGINT       NOT NULL,
    strike_count_at_ban       INT          NOT NULL,
    ban_started_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ban_ends_at               DATETIME     NOT NULL,
    reason                    VARCHAR(200) NOT NULL,
    source_strike_id          BIGINT       NOT NULL,
    requires_manual_review    TINYINT(1)   NOT NULL DEFAULT 0,
    reviewed                  TINYINT(1)   NOT NULL DEFAULT 0,
    reviewed_at               DATETIME     NULL,
    reviewed_by               BIGINT       NULL,
    created_at                DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_model_moderation_bans_source_strike
        FOREIGN KEY (source_strike_id) REFERENCES model_moderation_strikes(id),
    INDEX idx_model_moderation_bans_model_ends (model_user_id, ban_ends_at),
    INDEX idx_model_moderation_bans_review (requires_manual_review, reviewed)
);
