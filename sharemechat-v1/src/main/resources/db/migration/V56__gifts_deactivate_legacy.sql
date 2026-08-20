-- V56 (2026-08-20): completa la canonicalizacion de V55 desactivando los
-- regalos legacy que quedaban ACTIVOS fuera del catalogo canonico.
--
-- V55 sembro/sincronizo los 13 canonicos (8 de pago + 5 objetos gratis) pero NO
-- desactivo filas legacy preexistentes. En PROD la tabla arranco vacia, asi que
-- alli no habia ninguna (no-op). En TEST/AUDIT quedaban activas 8 "caras"
-- antiguas de tier quick (basic/flirty/hot/laugh/love/ok/sad/wow) que el frontend
-- ya ocultaba (FACE_GIFT_CODES) pero que /api/gifts y /products/emojis/available
-- seguian sirviendo. Esto las retira del catalogo, dejando ACTIVOS solo los 13
-- canonicos documentados en docs/02-architecture/gifts-catalog.md.
--
-- Idempotente y seguro para el historial: solo UPDATE active=0 (no DELETE), asi
-- que las FK transactions.gift_id -> gifts.id siguen intactas.

UPDATE gifts
   SET active = 0
 WHERE active = 1
   AND code NOT IN (
     'heart','star','fire','sparkle','labios',
     'rosa','cocktail','teddy','gift','ring','corona','rocket','diamante'
   );
