-- V41 (ADR-054, 2026-07-27): sistema de tickets de incidencias.
--
-- Ticket como entidad de dominio propia (Opcion C del D1): tiene lifecycle
-- propio, evidencia adjunta, y compensacion economica linkada. La comunicacion
-- agente humano <-> cliente sobre el ticket va por support_conversations
-- existente (reuso ADR-046) mediante linked_conversation_id.
--
-- Correccion respecto al ADR-054 modelo de datos: el ADR menciona
-- "stream_sessions" y "payment_sessions" como fuentes de verdad para la
-- verificacion automatica. Los nombres REALES en el schema son:
--   - stream_records (con id, client_id, model_id, start_time, end_time...)
--   - stream_status_events (event_type: CREATED/CONFIRMED/BILLING_STARTED/
--                           ENDED/CUT_LOW_BALANCE/DISCONNECT/TIMEOUT)
--   - payment_sessions (correcto en el ADR).
-- Esta migration usa los nombres reales del schema.
--
-- FK circular support_tickets <-> transactions se resuelve por orden de
-- INSERT en el flujo de compensacion: primero se crea el ticket con estado
-- RESOLVED_COMPENSATED_PENDING_CREDIT (compensated_transaction_id NULL);
-- despues manualRefundToClient crea la Transaction con ticket_id set; despues
-- se actualiza el ticket con compensated_transaction_id y estado
-- RESOLVED_COMPENSATED. Ambos lados de la FK admiten NULL para permitir el
-- orden.

CREATE TABLE support_tickets (
    id                              BIGINT       PRIMARY KEY AUTO_INCREMENT,
    user_id                         BIGINT       NOT NULL,
    category                        VARCHAR(40)  NOT NULL,
    status                          VARCHAR(40)  NOT NULL DEFAULT 'OPEN',
    description                     TEXT         NOT NULL,
    reported_incident_at            DATETIME     NULL,
    linked_conversation_id          BIGINT       NULL,
    linked_stream_record_id         BIGINT       NULL,
    linked_payment_session_id       BIGINT       NULL,
    verification_last_run_at        DATETIME     NULL,
    verification_last_result_json   JSON         NULL,
    verification_last_signal        VARCHAR(20)  NULL,
    compensated_amount_eur          DECIMAL(10,2) NULL,
    compensated_transaction_id      BIGINT       NULL,
    resolved_at                     DATETIME     NULL,
    resolved_by_admin_id            BIGINT       NULL,
    resolution_notes                TEXT         NULL,
    high_history_flag               TINYINT(1)   NOT NULL DEFAULT 0,
    created_at                      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ticket_user
        FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_ticket_conv
        FOREIGN KEY (linked_conversation_id) REFERENCES support_conversations(id),
    CONSTRAINT fk_ticket_stream
        FOREIGN KEY (linked_stream_record_id) REFERENCES stream_records(id),
    CONSTRAINT fk_ticket_payment
        FOREIGN KEY (linked_payment_session_id) REFERENCES payment_sessions(id),
    CONSTRAINT fk_ticket_admin
        FOREIGN KEY (resolved_by_admin_id) REFERENCES users(id),
    CONSTRAINT chk_ticket_category CHECK (category IN (
        'STREAM_INTERRUPTED',
        'PAYMENT_NOT_CREDITED',
        'MODERATION_FALSE_POSITIVE',
        'ACCOUNT_ISSUE',
        'OTHER'
    )),
    CONSTRAINT chk_ticket_status CHECK (status IN (
        'OPEN',
        'INVESTIGATING',
        'RESOLVED_COMPENSATED_PENDING_CREDIT',
        'RESOLVED_COMPENSATED',
        'RESOLVED_NO_COMPENSATION',
        'REJECTED_INVALID',
        'ABANDONED'
    )),
    CONSTRAINT chk_ticket_signal CHECK (
        verification_last_signal IS NULL OR verification_last_signal IN (
            'STRONG_POSITIVE',
            'WEAK_POSITIVE',
            'NEUTRAL',
            'NEGATIVE'
        )
    ),
    INDEX idx_ticket_user (user_id, created_at DESC),
    INDEX idx_ticket_status (status, created_at DESC),
    INDEX idx_ticket_category (category, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Columna nueva en transactions para linkar la compensacion al ticket
-- que la origino (D4 del ADR-054). Nullable: la mayoria de transactions
-- (INGRESO por pago, MANUAL_REFUND libre pre-ticket, GIFT, etc.) no tienen
-- ticket asociado.
ALTER TABLE transactions
    ADD COLUMN ticket_id BIGINT NULL,
    ADD CONSTRAINT fk_tx_ticket
        FOREIGN KEY (ticket_id) REFERENCES support_tickets(id),
    ADD INDEX idx_tx_ticket (ticket_id);

-- FK ticket -> transaction compensada. Se crea aqui, DESPUES del ALTER
-- de transactions, porque necesita que transactions ya exista con la
-- estructura completa. En runtime esta FK se popula tras el flujo de
-- compensacion (ver header).
ALTER TABLE support_tickets
    ADD CONSTRAINT fk_ticket_tx
        FOREIGN KEY (compensated_transaction_id) REFERENCES transactions(id);
