-- V27: Tabla `psp_webhook_events` para idempotencia + auditoría de
-- webhooks IPN de PSPs (ADR-051 D3).
--
-- Contexto: calcada bit-a-bit del schema `kyc_webhook_events`
-- (V1__baseline.sql:295) que se usa hoy con éxito para Didit/Veriff.
-- Patrón industrial ya probado: UNIQUE(provider, provider_event_id)
-- para dedup del IPN, INDEX por payment_id para reconciliación,
-- payload_json LONGTEXT para auditoría forense, is_signature_valid
-- + is_processed + processing_error_message para el status.
--
-- Diferencias vs kyc_webhook_events:
-- - `provider_payment_id` en lugar de `provider_session_id` (el
--   equivalente semántico en PSP; NOWPayments lo llama payment_id).
-- - `payment_status` VARCHAR nueva (snapshot del status del pago
--   al recibir el evento: waiting/confirming/finished/failed/etc.).
--   Facilita queries analíticas sin re-parsear el payload_json.
--
-- Uso: PspWebhookOrchestratorService persiste SIEMPRE (aceptado o
-- rechazado por firma) para auditoría. La dedup por UNIQUE bloquea
-- la segunda entrega del mismo event_id al nivel de BD. Si el vendor
-- no envía event_id explícito, el service deriva SHA-256(rawBody) como
-- id sintético (patrón `KycSessionService.processDiditWebhook:481-490`).

CREATE TABLE psp_webhook_events (
    id BIGINT NOT NULL AUTO_INCREMENT,
    provider VARCHAR(30) NOT NULL,
    provider_event_id VARCHAR(150) NOT NULL,
    provider_payment_id VARCHAR(100) DEFAULT NULL,
    provider_event_type VARCHAR(100) DEFAULT NULL,
    payment_status VARCHAR(30) DEFAULT NULL,
    is_signature_valid TINYINT(1) NOT NULL DEFAULT 0,
    is_processed TINYINT(1) NOT NULL DEFAULT 0,
    processing_error_message VARCHAR(500) DEFAULT NULL,
    payload_json LONGTEXT NOT NULL,
    received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_pwe_provider_event (provider, provider_event_id),
    KEY idx_pwe_provider_payment (provider, provider_payment_id),
    KEY idx_pwe_processed (is_processed),
    KEY idx_pwe_processed_received_at (is_processed, received_at),
    KEY idx_pwe_provider_received_at (provider, received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
