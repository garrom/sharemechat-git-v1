-- V19__add_liveness_attempts_table.sql
--
-- ADR-050 Fase B: tabla de auditoria y estado de los intentos de
-- liveness challenge (SightEngine face-attributes).
--
-- Semantica: cada fila representa UN intento de un usuario de pasar un
-- challenge. Un usuario puede tener N filas historicas; la "pass vigente"
-- se resuelve por la fila mas reciente con status='PASSED' y
-- passed_until > NOW() UTC. Al expirar passed_until, la fila queda como
-- registro historico y el usuario debe pasar un nuevo challenge.
--
-- Diseno:
-- - challenge_type discrimina los 4 tipos {BLINK, TURN_LEFT, TURN_RIGHT,
--   SMILE} definidos en D4. CHECK constraint activo en MySQL 8+.
-- - status transita PENDING -> PASSED | FAILED | EXPIRED. Solo PASSED
--   habilita startMatch. EXPIRED es el estado terminal cuando el frontend
--   no completa el verify en TTL corto (~2 minutos, se aplica por job de
--   limpieza o al abrir challenge nuevo del mismo user).
-- - sightengine_verdict JSON almacena la respuesta cruda de SightEngine
--   para reproducibilidad y calibracion empirica de umbrales D4 y D5. En
--   modo MOCK o fail-closed-soft, guarda {"mock":true} o
--   {"vendor_unavailable":true} respectivamente.
-- - prompt_lc guarda el codigo del prompt mostrado al usuario (ej.
--   "BLINK_TWICE"), no el texto localizado. La localizacion vive en i18n.
-- - passed_until: NULL mientras status != PASSED. Cuando PASSED, se
--   calcula como created_at + property ttl_seconds (24h por D3, 5 min por
--   D5 en fail-closed-soft).
-- - resolved_at: NULL mientras status = PENDING. Timestamp UTC del
--   momento en que status paso a terminal (PASSED/FAILED/EXPIRED).
-- - Cero PII sensible. El JSON de SightEngine solo trae scores numericos
--   y bounding boxes de la cara, no la imagen.
--
-- Indices:
-- - idx_la_user_passed: soporta la query hot "el usuario X tiene pass
--   vigente" (WHERE user_id = ? AND status = 'PASSED' AND passed_until > ?).
-- - idx_la_user_created: soporta rate limit D6 (contar attempts fallidos
--   del user en las ultimas 24h).
-- - idx_la_created: soporta job de purga D10 (retention_days).

CREATE TABLE liveness_attempts (
    id                    BIGINT       PRIMARY KEY AUTO_INCREMENT,
    user_id               BIGINT       NOT NULL,
    challenge_type        VARCHAR(20)  NOT NULL
        COMMENT 'ADR-050 D4: BLINK, TURN_LEFT, TURN_RIGHT, SMILE',
    prompt_lc             VARCHAR(40)  NOT NULL
        COMMENT 'Codigo del prompt mostrado al usuario. La traduccion vive en i18n.',
    status                VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
        COMMENT 'PENDING -> PASSED | FAILED | EXPIRED. Solo PASSED con passed_until > NOW habilita startMatch.',
    sightengine_verdict   JSON         NULL
        COMMENT 'Respuesta cruda de SightEngine (D10) o marcadores especiales {mock:true} / {vendor_unavailable:true} (D5).',
    frames_count          INT          NOT NULL DEFAULT 0
        COMMENT 'Numero de frames enviados a SightEngine en el verify. Tipico: 3.',
    passed_until          DATETIME     NULL
        COMMENT 'Ventana de validez del pass. NULL mientras status != PASSED. UTC estricto.',
    created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
        COMMENT 'Timestamp UTC del startChallenge.',
    resolved_at           DATETIME     NULL
        COMMENT 'Timestamp UTC de la transicion a estado terminal (PASSED/FAILED/EXPIRED).',
    CONSTRAINT fk_la_user
        FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT chk_la_challenge_type CHECK (
        challenge_type IN ('BLINK','TURN_LEFT','TURN_RIGHT','SMILE')
    ),
    CONSTRAINT chk_la_status CHECK (
        status IN ('PENDING','PASSED','FAILED','EXPIRED')
    ),
    CONSTRAINT chk_la_passed_until_only_when_passed CHECK (
        (status = 'PASSED' AND passed_until IS NOT NULL) OR
        (status <> 'PASSED' AND passed_until IS NULL)
    ),
    CONSTRAINT chk_la_frames_count_non_negative CHECK (
        frames_count >= 0
    ),
    INDEX idx_la_user_passed (user_id, status, passed_until),
    INDEX idx_la_user_created (user_id, created_at),
    INDEX idx_la_created (created_at)
);
