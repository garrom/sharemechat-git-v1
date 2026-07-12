-- V18__affiliate_commissions_source_generic.sql
--
-- Extension del schema affiliate_commissions (V16) para soportar multiples
-- fuentes de comision (STREAM_CHARGE actual + PAYMENT_SESSION futuro).
--
-- Ver ADR-049 seccion "Actualizacion 2026-07-12 - Cambio semantico del
-- trigger de comision (D2 revisado) y esquema source_type/source_id".
--
-- Motivo del cambio: el D2 original acumulaba comision al SUCCESS de
-- PaymentSession (importe recargado). El D2 revisado acumula al
-- STREAM_CHARGE (importe consumido) para garantizar cero riesgo cash-flow
-- (lo consumido es irrevocable, lo recargado puede volver por chargeback).
--
-- Diseno:
-- - source_type: discriminador de fuente. Valores en fase actual:
--   STREAM_CHARGE. Valores futuros previstos: PAYMENT_SESSION.
-- - source_id: FK logica al ID de la fuente (stream_records.id o
--   payment_sessions.id segun source_type). No FK fisica porque apunta a
--   distintas tablas; la integridad la garantiza el service.
-- - payment_session_id pasa a nullable. En filas con source_type='STREAM_CHARGE'
--   es NULL. Se conserva la columna por compatibilidad con futuras filas
--   generadas por hooks sobre PaymentSession.
-- - UNIQUE (source_type, source_id, status) para idempotencia + permitir
--   dos filas por fuente (por ejemplo PAYABLE + REVERSED_CHARGEBACK).

-- ============================================================
-- BLOQUE 1 - Anadir columnas source_type y source_id
-- ============================================================

ALTER TABLE affiliate_commissions
    ADD COLUMN source_type VARCHAR(30) NOT NULL DEFAULT 'PAYMENT_SESSION'
        COMMENT 'Discriminador de la fuente que dispara la comision. Valores actuales: STREAM_CHARGE. Futuros: PAYMENT_SESSION.',
    ADD COLUMN source_id BIGINT NULL
        COMMENT 'FK logica al ID de la fuente. stream_records.id para STREAM_CHARGE, payment_sessions.id para PAYMENT_SESSION.';

-- ============================================================
-- BLOQUE 2 - Backfill de filas existentes
-- Las filas existentes son todas de fuente PAYMENT_SESSION (mundo pre-D2-revisado).
-- source_id = payment_session_id para preservar la integridad.
-- ============================================================

UPDATE affiliate_commissions
   SET source_id = payment_session_id
 WHERE source_id IS NULL;

-- ============================================================
-- BLOQUE 3 - Endurecer source_id a NOT NULL tras el backfill
-- ============================================================

ALTER TABLE affiliate_commissions
    MODIFY COLUMN source_id BIGINT NOT NULL
        COMMENT 'FK logica al ID de la fuente. stream_records.id para STREAM_CHARGE, payment_sessions.id para PAYMENT_SESSION.';

-- ============================================================
-- BLOQUE 4 - Relajar payment_session_id a nullable
-- En filas con source_type='STREAM_CHARGE' es NULL.
-- ============================================================

ALTER TABLE affiliate_commissions
    MODIFY COLUMN payment_session_id BIGINT NULL
        COMMENT 'FK a payment_sessions.id. NULL cuando source_type=STREAM_CHARGE. Se conserva para compatibilidad con futuros hooks sobre PaymentSession.';

-- ============================================================
-- BLOQUE 5 - CHECK del enum source_type y UNIQUE de idempotencia
-- ============================================================

ALTER TABLE affiliate_commissions
    ADD CONSTRAINT chk_ac_source_type CHECK (
        source_type IN ('STREAM_CHARGE','PAYMENT_SESSION')
    );

ALTER TABLE affiliate_commissions
    ADD CONSTRAINT uq_ac_source_status UNIQUE (source_type, source_id, status);

-- ============================================================
-- BLOQUE 6 - Indice compuesto por referrer + periodo + status
-- Optimiza el panel modelo (D11 revisado en la actualizacion 2026-07-12):
-- "comisiones PAYABLE del mes actual para esta modelo".
-- Los indices viejos idx_ac_referrer_period + idx_ac_status del V16 se
-- conservan por compatibilidad con otras queries analiticas.
-- ============================================================

CREATE INDEX idx_ac_referrer_period_status
    ON affiliate_commissions (referrer_model_user_id, period_yyyymm, status);
