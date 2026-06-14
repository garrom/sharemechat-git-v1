-- V9: anadir campos para el flujo Didit CLIENTE (Age Estimation) en
-- kyc_sessions y users.
--
-- Motivacion (ADR-035, frente Didit cliente paso 2): la tabla kyc_sessions
-- (renombrada en V8) va a alojar tambien las sesiones del cliente (Adaptive
-- Age Verification). Hay que distinguir el tipo de sesion y guardar los
-- datos especificos de Age Estimation (edad estimada, score, threshold del
-- workflow) sin descartar el patron actual del modelo.
--
-- Alcance estricto: SOLO columnas nuevas + 1 indice nuevo. NO se borran
-- columnas, NO se cambian tipos existentes, NO se toca el constraint
-- uk_mks_provider_session, NO se modifican filas (excepto la UPDATE
-- explicita al final que es no-op porque la DEFAULT ya cubre el caso).

-- kyc_sessions: distinguir MODEL vs CLIENT + datos de Age Estimation.
ALTER TABLE kyc_sessions ADD COLUMN session_type VARCHAR(10) NOT NULL DEFAULT 'MODEL';
ALTER TABLE kyc_sessions ADD COLUMN estimated_age_decimal DECIMAL(5,2) NULL;
ALTER TABLE kyc_sessions ADD COLUMN confidence_score DECIMAL(5,2) NULL;
ALTER TABLE kyc_sessions ADD COLUMN age_estimation_threshold INT NULL;

-- users: campos del KYC del cliente (paralelo al verification_status del modelo).
ALTER TABLE users ADD COLUMN client_kyc_status VARCHAR(20) NULL;
ALTER TABLE users ADD COLUMN client_kyc_decided_at DATETIME NULL;
ALTER TABLE users ADD COLUMN client_kyc_estimated_age DECIMAL(5,2) NULL;

-- Backfill explicito coherente con la DEFAULT (no-op): las filas existentes
-- (en TEST: solo id=14, del modelo) quedan marcadas como MODEL. Lo dejamos
-- escrito para revision; un futuro mantenimiento podria querer auditar este
-- backfill explicitamente.
UPDATE kyc_sessions SET session_type = 'MODEL' WHERE provider IN ('VERIFF', 'DIDIT');

-- Indice util para gating del cliente: "tiene el user 87 alguna sesion
-- CLIENT en APPROVED?" Sera consulta caliente cuando integremos /transactions/
-- add-balance con el gate. Columna kyc_status va al final para que el indice
-- sirva tambien al filtrado por (user_id, session_type) sin kyc_status.
CREATE INDEX idx_kyc_sessions_user_session_type ON kyc_sessions(user_id, session_type, kyc_status);
