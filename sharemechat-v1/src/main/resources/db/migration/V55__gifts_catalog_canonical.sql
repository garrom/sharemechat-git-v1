-- V55 (2026-08-20): catalogo canonico de regalos (all-emoji) + base consistente.
--
-- Contexto: el catalogo de `gifts` era dato manual de BD, sin documentar y con
-- drift entre entornos ("notitas entre sesiones"). El esquema de origen dejaba
-- `code` opcional y NO unico, permitiendo duplicados (p.ej. GIFT_KISS x2 en TEST)
-- y filas legacy. PROD esta limpio (tabla vacia, sin regalos enviados).
--
-- Decision de producto (2026-08-19): TODO el catalogo activo se pinta como EMOJI
-- nativo (gratis y de pago); el frontend (GiftIcon) resuelve el emoji por `code`.
-- Aqui guardamos el emoji tambien en `icon` para que la fila sea autodescriptiva
-- (la URL .webp del render viejo queda obsoleta).
--
-- Esta migracion:
--   1) Deduplica por `code` (defensivo; en PROD vacio es no-op).
--   2) Fija la base: `code` NOT NULL + UNIQUE (identidad del regalo).
--   3) Siembra los 13 canonicos (8 de pago + 5 objetos gratis), idempotente.
--
-- Las 34 caritas del selector de emojis del chat (boton emoji) NO son regalos y
-- NO viven en esta tabla. Fuente unica documentada:
-- docs/02-architecture/gifts-catalog.md

-- 1) Dedup defensivo por code (mantiene la fila de menor id). PROD vacio -> no-op.
DELETE g1 FROM gifts g1
  INNER JOIN gifts g2 ON g1.code = g2.code AND g1.id > g2.id;

-- 2) Base consistente: code obligatorio y unico.
ALTER TABLE gifts MODIFY COLUMN code VARCHAR(64) NOT NULL;
ALTER TABLE gifts ADD UNIQUE KEY uq_gifts_code (code);

-- 3) Catalogo canonico. Idempotente por UNIQUE(code): en PROD inserta los 13; en
--    entornos con las filas ya presentes las sincroniza a estos valores.
INSERT INTO gifts (code, name, tier, cost, active, featured, icon, sort_order) VALUES
  ('heart',    'Corazón',          'quick',    0.00, 1, 0, '❤️', 1),
  ('star',     'Estrella',         'quick',    0.00, 1, 0, '⭐', 2),
  ('fire',     'Fuego',            'quick',    0.00, 1, 0, '🔥', 3),
  ('sparkle',  'Destello',         'quick',    0.00, 1, 0, '✨', 4),
  ('labios',   'Labios',           'quick',    0.00, 1, 0, '💋', 5),
  ('rosa',     'Rosa',             'premium',  1.00, 1, 0, '🌹', 10),
  ('cocktail', 'Cóctel',           'premium',  3.00, 1, 0, '🍸', 11),
  ('teddy',    'Osito',            'premium',  5.00, 1, 0, '🧸', 12),
  ('gift',     'Caja de regalos',  'premium',  8.00, 1, 0, '🎁', 13),
  ('ring',     'Anillo',           'premium', 12.00, 1, 0, '💍', 14),
  ('corona',   'Corona',           'premium', 15.00, 1, 1, '👑', 15),
  ('rocket',   'Cohete',           'premium', 20.00, 1, 0, '🚀', 16),
  ('diamante', 'Diamante',         'premium', 25.00, 1, 1, '💎', 17)
ON DUPLICATE KEY UPDATE
  name       = VALUES(name),
  tier       = VALUES(tier),
  cost       = VALUES(cost),
  active     = VALUES(active),
  featured   = VALUES(featured),
  icon       = VALUES(icon),
  sort_order = VALUES(sort_order);
