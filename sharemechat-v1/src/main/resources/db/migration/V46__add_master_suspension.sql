-- V46 (ADR-056 Fase S7.b, 2026-08-02): suspensión de Masters.
--
-- Añade columnas de suspensión a masters. Semántica:
--
--   suspended_at IS NULL          → Master operativo normalmente.
--   suspended_at IS NOT NULL      → Master suspendido (D11):
--     * suspended_by_user_id     → admin que aplicó la suspensión (audit).
--     * suspension_reason        → texto libre (max 500) motivo.
--     * En Java, MasterSuspensionService.suspend() ejecuta en transacción:
--         - UPDATE masters SET suspended_at=now, suspended_by=?, reason=?
--         - UPDATE models SET master_user_id=NULL WHERE master_user_id=?
--           (modelos liberadas como individuales, historial atribuido
--           intacto vía transactions.attributed_model_user_id)
--         - UPDATE master_model_splits SET effective_to=now
--           WHERE master_user_id=? AND effective_to IS NULL
--     * MasterSuspendedFilter (nuevo) bloquea POST/PATCH/DELETE sensibles
--       bajo /api/masters/me/** (invitar modelos, editar %, activar).
--     * Whitelist permitida: GET /me/** + POST /me/payout (puede retirar
--       saldo pre-suspensión) + POST /me/contract/accept + /me/kyc/didit.
--
-- Reactivación (POST /admin/masters/{id}/reactivate): suspended_at=NULL,
-- suspended_by_user_id=NULL, suspension_reason=NULL. Las modelos NO se
-- re-asignan automáticamente (siguen como individuales tras liberación).
-- Si el Master reactivado quiere volver a onboardearlas, debe re-invitar
-- (endpoint existente POST /api/masters/me/models).

ALTER TABLE masters
    ADD COLUMN suspended_at         TIMESTAMP    NULL DEFAULT NULL AFTER onboarded_at,
    ADD COLUMN suspended_by_user_id BIGINT       NULL DEFAULT NULL AFTER suspended_at,
    ADD COLUMN suspension_reason    VARCHAR(500) NULL DEFAULT NULL AFTER suspended_by_user_id,
    ADD CONSTRAINT fk_masters_suspended_by FOREIGN KEY (suspended_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    ADD INDEX idx_masters_suspended (suspended_at);
