-- V26: Añadir columna `provider` a `payment_sessions` (ADR-051 Fase 1).
--
-- Contexto: `payment_sessions` (V1__baseline.sql:509) tiene schema neutro
-- que puede aceptar cualquier PSP, pero le faltaba la columna que
-- discrimina el emisor. Hasta ahora no importó porque `PaymentSession`
-- estaba huérfano tras el cierre H7 (CCBill eliminado en commit
-- f9fea4a, 2026-06-08). Con NOWPayments arrancando como primer PSP
-- vivo y Vendo/CommerceGate/RocketGate en el horizonte cercano
-- (ADR-047, ADR-051), la columna es imprescindible.
--
-- Cambios:
-- 1) ADD COLUMN provider VARCHAR(30) NOT NULL DEFAULT 'nowpayments'.
--    Filas existentes: cero (nunca hubo tráfico real), así que el
--    DEFAULT solo aplica a inserciones futuras que no lo especifiquen
--    (defensivo; el código siempre lo va a poner explícito).
-- 2) DROP UNIQUE(psp_transaction_id) global + ADD UNIQUE(provider,
--    psp_transaction_id). Sin esto, un futuro segundo PSP podría chocar
--    con NOWPayments si ambos generasen el mismo transaction_id (el
--    riesgo hoy es teórico con UUID de NOWPayments, pero evitamos la
--    deuda futura resolviéndolo ahora que la tabla está vacía).
-- 3) INDEX(provider) para queries administrativas por vendor.

ALTER TABLE payment_sessions
    ADD COLUMN provider VARCHAR(30) NOT NULL DEFAULT 'nowpayments' AFTER pack_id;

ALTER TABLE payment_sessions
    DROP INDEX uk_payment_sessions_psp;

ALTER TABLE payment_sessions
    ADD UNIQUE KEY uk_payment_sessions_provider_psp (provider, psp_transaction_id);

ALTER TABLE payment_sessions
    ADD INDEX idx_payment_sessions_provider (provider);
