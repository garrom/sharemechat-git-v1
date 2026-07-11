-- Subpasada 1 del sistema de afiliadas (ADR-049).
-- Introduce el schema de base de datos del programa de afiliadas:
--   * columnas nuevas en `users` para el codigo de afiliacion de la modelo
--     y para la atribucion permanente cliente -> modelo referidora.
--   * columna nueva en `payout_requests` para separar payouts de streaming
--     de payouts de comisiones de afiliacion.
--   * tres tablas nuevas: `affiliate_link_tokens` (magic link tipo
--     EmailVerificationToken), `affiliate_click_events` (log de eventos
--     de tracking con hashes SHA-256 truncados, D15 GDPR-friendly) y
--     `affiliate_commissions` (comisiones acumuladas por evento de pago).
--
-- Decisiones estructurales:
-- - Codigo y atribucion viven en `users`, no en tablas separadas. Un USER
--   MODEL puede ser afiliada (referral_code_owner NOT NULL). Un USER en
--   cualquier rol puede haber sido referido (referred_by_user_id NOT NULL).
-- - Charset del codigo: Crockford's Base32 sin ambiguos (sin I, L, O, U).
--   Longitud fija 12 caracteres. CHECK constraint activo en MySQL 8.
-- - Comisiones en cents (BIGINT) y no en DECIMAL para calculos exactos y
--   compatibilidad con multi-moneda futura sin cambio de tipo.
-- - Reversos por chargeback: UNIQUE compuesto (payment_session_id, status)
--   permite dos filas por sesion de pago con distinto status (por ejemplo
--   ACCRUED + REVERSED_CHARGEBACK), no UNIQUE simple sobre payment_session_id.
-- - Hashes de IP y User-Agent truncados a 16 caracteres hex (64 bits).
--   No reversibles. Suficientes para agregacion anti-abuso.

-- =============================================================
-- BLOQUE 1 - Ampliacion de `users`: codigo afiliacion + atribucion
-- =============================================================

ALTER TABLE users
    ADD COLUMN referral_code_owner VARCHAR(12) NULL
        COMMENT 'Codigo de afiliacion de la modelo. Charset Crockford Base32 sin I,L,O,U. Longitud fija 12. NULL si no activada.',
    ADD COLUMN referred_by_user_id BIGINT NULL
        COMMENT 'user_id de la modelo referidora si el USER llego por afiliacion. Inmutable tras el registro.',
    ADD COLUMN referred_at DATETIME NULL
        COMMENT 'Timestamp de la atribucion en el registro. NULL si no hay atribucion.';

ALTER TABLE users
    ADD CONSTRAINT uq_users_referral_code_owner UNIQUE (referral_code_owner);

ALTER TABLE users
    ADD CONSTRAINT fk_users_referred_by
        FOREIGN KEY (referred_by_user_id) REFERENCES users(id);

CREATE INDEX idx_users_referred_by ON users (referred_by_user_id);

-- CHECK del charset del codigo. MySQL 8.0.16+ enforce CHECK activo.
-- Si en un futuro se ejecuta sobre MySQL <8.0.16, el CHECK se ignora
-- silenciosamente sin bloquear la migracion.
ALTER TABLE users
    ADD CONSTRAINT chk_users_referral_code_owner_charset CHECK (
        referral_code_owner IS NULL
        OR referral_code_owner REGEXP '^[0-9A-HJKMNPQRSTVWXYZ]{12}$'
    );

-- =============================================================
-- BLOQUE 2 - Ampliacion de `payout_requests`: separacion STREAM/AFFILIATE
-- =============================================================

ALTER TABLE payout_requests
    ADD COLUMN payout_type VARCHAR(20) NOT NULL DEFAULT 'STREAM'
        COMMENT 'Tipo de payout: STREAM (payout ordinario del streaming) o AFFILIATE (payout agregado de comisiones de afiliacion).';

ALTER TABLE payout_requests
    ADD CONSTRAINT chk_pr_payout_type CHECK (
        payout_type IN ('STREAM', 'AFFILIATE')
    );

CREATE INDEX idx_pr_payout_type ON payout_requests (payout_type);

-- =============================================================
-- BLOQUE 3 - Tabla nueva `affiliate_link_tokens`
-- Magic link tipo Uber/Airbnb: el visitante mete su email en la landing,
-- recibe un email con URL /i/<token>, al abrirlo en cualquier dispositivo
-- se resetea la cookie de referral. Patron calcado de EmailVerificationToken.
-- =============================================================

CREATE TABLE affiliate_link_tokens (
    id                  BIGINT       PRIMARY KEY AUTO_INCREMENT,
    token_hash          CHAR(64)     NOT NULL,
    model_user_id       BIGINT       NOT NULL,
    email               VARCHAR(255) NULL,
    expires_at          DATETIME     NOT NULL,
    consumed_at         DATETIME     NULL,
    created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_alt_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_alt_model
        FOREIGN KEY (model_user_id) REFERENCES users(id),
    INDEX idx_alt_expires (expires_at),
    INDEX idx_alt_model (model_user_id)
);

-- =============================================================
-- BLOQUE 4 - Tabla nueva `affiliate_click_events`
-- Log de eventos de tracking del funnel: CLICK / EMAIL_SUBMITTED /
-- LINK_CONSUMED / REGISTERED / FIRST_PAYMENT. Hashes SHA-256 truncados
-- a 16 chars (D15 GDPR). No IPs planas jamas.
-- =============================================================

CREATE TABLE affiliate_click_events (
    id                  BIGINT       PRIMARY KEY AUTO_INCREMENT,
    model_user_id       BIGINT       NOT NULL,
    event_type          VARCHAR(20)  NOT NULL,
    client_user_id      BIGINT       NULL,
    ip_hash             CHAR(16)     NULL
        COMMENT 'SHA-256(ip + salt) truncado a 16 chars hex (64 bits). No reversible.',
    ua_hash             CHAR(16)     NULL
        COMMENT 'SHA-256(user_agent + salt) truncado a 16 chars hex. Opcional.',
    created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ace_model
        FOREIGN KEY (model_user_id) REFERENCES users(id),
    CONSTRAINT fk_ace_client
        FOREIGN KEY (client_user_id) REFERENCES users(id),
    CONSTRAINT chk_ace_event_type CHECK (
        event_type IN ('CLICK','EMAIL_SUBMITTED','LINK_CONSUMED','REGISTERED','FIRST_PAYMENT')
    ),
    INDEX idx_ace_model_created (model_user_id, created_at),
    INDEX idx_ace_created (created_at),
    INDEX idx_ace_client (client_user_id)
);

-- =============================================================
-- BLOQUE 5 - Tabla nueva `affiliate_commissions`
-- Comisiones acumuladas por evento de pago del cliente atribuido.
-- Base y comision en cents BIGINT. Rate en basis points (3000 = 30%).
-- Periodo YYYYMM (INT). Estados ACCRUED / PAYABLE / SKIPPED_NO_ACTIVITY /
-- REVERSED_CHARGEBACK / PAID. UNIQUE compuesto (payment_session_id, status)
-- permite reversos.
-- =============================================================

CREATE TABLE affiliate_commissions (
    id                          BIGINT       PRIMARY KEY AUTO_INCREMENT,
    client_user_id              BIGINT       NOT NULL,
    referrer_model_user_id      BIGINT       NOT NULL,
    payment_session_id          BIGINT       NOT NULL,
    base_amount_cents           BIGINT       NOT NULL
        COMMENT 'Importe cobrado en centesimas de EUR (base de calculo).',
    rate_bps                    INT          NOT NULL DEFAULT 3000
        COMMENT 'Rate de comision en basis points. 3000 = 30%.',
    commission_amount_cents     BIGINT       NOT NULL
        COMMENT 'Comision efectiva en centesimas de EUR. Puede ser negativa en REVERSED_CHARGEBACK.',
    period_yyyymm               INT          NOT NULL
        COMMENT 'Anio*100 + mes calendario del cobro. Ej 202607.',
    status                      VARCHAR(30)  NOT NULL,
    paid_via_payout_request_id  BIGINT       NULL,
    created_at                  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_ac_payment_session_status UNIQUE (payment_session_id, status),
    CONSTRAINT fk_ac_client
        FOREIGN KEY (client_user_id) REFERENCES users(id),
    CONSTRAINT fk_ac_referrer
        FOREIGN KEY (referrer_model_user_id) REFERENCES users(id),
    CONSTRAINT fk_ac_payment_session
        FOREIGN KEY (payment_session_id) REFERENCES payment_sessions(id),
    CONSTRAINT fk_ac_payout
        FOREIGN KEY (paid_via_payout_request_id) REFERENCES payout_requests(id),
    CONSTRAINT chk_ac_status CHECK (
        status IN ('ACCRUED','PAYABLE','SKIPPED_NO_ACTIVITY','REVERSED_CHARGEBACK','PAID')
    ),
    INDEX idx_ac_referrer_period (referrer_model_user_id, period_yyyymm),
    INDEX idx_ac_status (status),
    INDEX idx_ac_client (client_user_id)
);
