-- ============================================================
-- V6__model_asset_review_cancelled_status.sql
-- ============================================================
-- Capa 2 Fase 7: amplía el CHECK constraint de model_asset_reviews.status
-- para admitir el estado CANCELLED. Semánticamente:
--
--   PENDING_REVIEW  -> review esperando decisión del admin (cola).
--   APPROVED        -> admin aprobó el asset (visible al cliente).
--   REJECTED        -> admin rechazó el asset (asset queda no visible
--                      al cliente; email de rechazo enviado al modelo).
--   CANCELLED (V6)  -> el modelo eliminó su propio asset antes de que
--                      el admin decidiera. La review se cancela; el
--                      asset físico ya no existe (hard-delete + S3
--                      cleanup) y la FK asset_id queda NULL por la
--                      regla ON DELETE SET NULL de V5. CANCELLED es
--                      distinto de REJECTED para que la auditoría
--                      pueda discriminar entre "rechazo del admin"
--                      y "retirada por el modelo".
--
-- Migración Capa 1 -> Capa 2 contexto: V4 introdujo el CHECK con los
-- 3 valores originales; V6 lo amplía a 4. El cambio es ADDITIVO; las
-- filas existentes con status PENDING_REVIEW/APPROVED/REJECTED siguen
-- válidas.
--
-- Idempotencia: NO idempotente. Flyway garantiza ejecución única.
-- ============================================================

ALTER TABLE model_asset_reviews
    DROP CONSTRAINT chk_model_asset_reviews_status;

ALTER TABLE model_asset_reviews
    ADD CONSTRAINT chk_model_asset_reviews_status
        CHECK (status IN ('PENDING_REVIEW','APPROVED','REJECTED','CANCELLED'));
