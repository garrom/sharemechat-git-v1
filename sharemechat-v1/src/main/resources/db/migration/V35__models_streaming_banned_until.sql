-- V35: flag caliente de ban de streaming en el perfil del modelo. Cuando
-- NOT NULL y > NOW() la modelo esta suspendida SOLO para streaming
-- (matching random, calls). Puede seguir usando el resto de la app:
-- login, chat de soporte, ver historial, etc. (Coomeet-style).
--
-- La escritura la hace ModelBanService al emitir ban; la lectura la
-- hace MatchingHandlerSupport.canMatch como gate en caliente sin tener
-- que ir a model_moderation_bans en cada match.

ALTER TABLE models
    ADD COLUMN streaming_banned_until DATETIME NULL
        COMMENT 'Fecha/hora fin de ban de streaming automatico. NULL o pasado = no baneada. Escrito por ModelBanService (ADR-037 Bloque 3), leido por matching gate.';

CREATE INDEX idx_models_streaming_banned_until ON models (streaming_banned_until);
