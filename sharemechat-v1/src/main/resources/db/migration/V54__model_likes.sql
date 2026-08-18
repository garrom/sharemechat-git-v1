-- V54 (Card 1 Fase 3, 2026-08-18): likes de cliente a modelo + insignias.
--
-- Un cliente puede dar "like" a una modelo (toggle). El anti-abuso es
-- ESTRUCTURAL: UNIQUE(client_user_id, model_user_id) garantiza 1 like por
-- par, sin necesidad de moderacion. El contador se obtiene con COUNT(*);
-- la insignia (Tiara/Diadema/Corona/Corona de Gemas/Imperial) se resuelve
-- en Java contra la escalera de umbrales (10/25/50/100/250).
--
-- IF NOT EXISTS + ddl-auto=validate en todos los entornos -> el shape aqui
-- DEBE coincidir con la entity ModelLike y con el baseline IT.

CREATE TABLE IF NOT EXISTS model_likes (
    id              BIGINT NOT NULL AUTO_INCREMENT,
    client_user_id  BIGINT NOT NULL,
    model_user_id   BIGINT NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_model_likes_client
        FOREIGN KEY (client_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_model_likes_model
        FOREIGN KEY (model_user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_model_likes_pair (client_user_id, model_user_id),
    KEY idx_model_likes_model (model_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
