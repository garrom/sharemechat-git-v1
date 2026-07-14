-- V21__stream_moderation_frozen_frame_detection.sql
--
-- ADR-050 Fase D: detección server-side de frame congelado.
--
-- Motivo: si la webcam de la modelo se congela (hardware barato, driver
-- fallando o intencional), el flujo actual sigue enviando el mismo
-- frame al backend cada ciclo de moderacion. SightEngine face-presence
-- devuelve in-scene alto (imagen de persona real) y no detecta la
-- congelacion. La sesion sigue viva y el cliente sigue pagando por
-- streaming inexistente.
--
-- Diseno: server-side hashing SHA-256 del frame recibido. Si es igual
-- al anterior, se incrementa un contador; al superar el umbral (property
-- moderation.presence.frozen-max-consecutive), se dispara categoria
-- FROZEN_STREAM con severity CRITICAL, misma via de enforcement que
-- OUT_OF_SCENE (auto-cut).
--
-- Coste operativo: cero (hash calculado local, sin llamadas extra al
-- vendor). Un hash de 64 bytes por sesion como estado.

ALTER TABLE stream_moderation_sessions
    ADD COLUMN last_frame_sha256 CHAR(64) NULL
        COMMENT 'ADR-050 Fase D: SHA-256 hex del ultimo frame recibido; NULL antes del primer frame.',
    ADD COLUMN consecutive_identical_frames INT NOT NULL DEFAULT 0
        COMMENT 'ADR-050 Fase D: contador de frames identicos consecutivos (via hash). Se resetea al recibir un frame distinto.';
