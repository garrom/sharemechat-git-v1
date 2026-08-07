-- ADR-054 D8 Fase C (2026-08-07): sube el AUTO_INCREMENT de support_tickets
-- a 10001 para que los nuevos tickets nazcan con IDs de 5 cifras. Racional
-- UX: un ticket "#3" da aspecto de aplicación recién estrenada; "#10007"
-- transmite madurez sin comprometer nada operativo. Aplica identicamente
-- en TEST, AUDIT y PROD (idempotente: si ya hay tickets con id >= 10001
-- el AUTO_INCREMENT queda en el mayor + 1 automaticamente).
--
-- Requisito: no debe haber tickets con id >= 10001 al momento del ALTER;
-- si los hubiera, MySQL ignoraria el valor solicitado y respetaria max(id)+1.
-- En TEST no hay tickets (bitacora entrada 2026-08-07: limpieza de tickets
-- test previa al refactor). En AUDIT/PROD el ALTER puede ejecutarse en
-- cualquier momento — solo aplica a INSERT futuros.

ALTER TABLE support_tickets AUTO_INCREMENT = 10001;
