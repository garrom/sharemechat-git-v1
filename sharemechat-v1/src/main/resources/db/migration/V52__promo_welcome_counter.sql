-- Promo "100 primeros clientes" (welcome): contador atómico de bonos concedidos.
--
-- ADITIVA: crea una tabla nueva; NO toca users, clients, transactions,
-- balances ni ninguna tabla existente. Riesgo cero para los datos reales
-- (clientes y modelo ya registrados en PROD quedan intactos).
--
-- El cupo (cap) NO vive aquí: lo aporta la config (product.promo.welcome.cap)
-- y se evalúa en un UPDATE condicional atómico, race-safe:
--
--   UPDATE promo_grant_counter SET granted = granted + 1
--   WHERE promo_key = 'WELCOME_100' AND granted < :cap;
--
-- Si el UPDATE afecta 1 fila => se concede el bono; si 0 => cupo lleno.
-- La concesión del bono (BONUS_GRANT/BONUS_FUNDING, BFPM ADR-012) va en la
-- MISMA transacción que la recarga, así que si algo revierte, el contador
-- también.

CREATE TABLE IF NOT EXISTS promo_grant_counter (
    promo_key   VARCHAR(64) NOT NULL PRIMARY KEY,
    granted     INT         NOT NULL DEFAULT 0,
    updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Fila semilla idempotente para la promo de bienvenida.
INSERT INTO promo_grant_counter (promo_key, granted)
VALUES ('WELCOME_100', 0)
ON DUPLICATE KEY UPDATE promo_key = promo_key;
