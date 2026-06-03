-- ============================================================
-- V7__model_contract_acceptances_restrict_user_fk.sql
-- ============================================================
-- Lote endurecimiento del flujo del Model Collaboration Agreement
-- (2026-06-04). Cambia la política ON DELETE de la FK
-- `fk_model_contract_user` (model_contract_acceptances -> users) de
-- CASCADE a RESTRICT.
--
-- Motivación:
--   - El registro de aceptación es prueba legal de consentimiento
--     informado por versión del contrato (timestamp, IP, user-agent,
--     hash). Debe sobrevivir al borrado del usuario.
--   - El baseline V1 declaró la FK con ON DELETE CASCADE; si un día
--     se borrara físicamente un user (no solo marcar `unsubscribe`),
--     todas sus aceptaciones desaparecerían silenciosamente y se
--     rompería el histórico auditable.
--
-- Política nueva:
--   - DELETE de un user con aceptaciones registradas => MySQL rechaza
--     la operación. El borrado físico exige decisión explícita
--     (anonimización GDPR previa, archivado, o ambos) y registrada en
--     procedimiento operativo.
--   - El flujo de baja actual (`/api/users/unsubscribe`) solo marca
--     `unsubscribe=true` sin DELETE, por lo que no se ve afectado.
--
-- Procedimiento de supresión completa (GDPR) en futuro:
--   Cuando exista flujo formal de borrado físico, deberá primero
--   anonimizar la PII en `model_contract_acceptances` (al menos
--   `ip_address` y `user_agent`) y conservar el hecho de aceptación
--   (`user_id`, `contract_version`, `contract_sha256`, `accepted_at`).
--   Documentado como riesgo abierto en known-risks.md hasta su
--   implementación.
--
-- Idempotencia: NO idempotente. Flyway garantiza ejecución única.
-- ============================================================

ALTER TABLE model_contract_acceptances
    DROP FOREIGN KEY fk_model_contract_user;

ALTER TABLE model_contract_acceptances
    ADD CONSTRAINT fk_model_contract_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE RESTRICT ON UPDATE CASCADE;
