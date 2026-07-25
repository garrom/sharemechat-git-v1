-- V40 (2026-07-25): rename tramos T0/T1/T2/T3 -> T1/T2/T3/T4.
--
-- Motivo UX del operador (feedback iter.3 del panel Tarifa): 'T0' se
-- confunde visualmente con 'TO' (letra O) en algunas fuentes/tamanios.
-- El shift a T1-T4 es cosmetico (los tier_code son strings opacos que
-- no participan en la logica de resolucion, que va por umbrales
-- min_billed_gross_eur_30d). No cambia el orden ni los umbrales ni el
-- reparto: solo el nombre.
--
-- Ordenamos las UPDATEs en cascada inversa (T3->T4, T2->T3, T1->T2,
-- T0->T1) para no colisionar con la UNIQUE (tier_code, effective_from)
-- de la fila destino durante el rename intermedio.

-- =============================================================
-- BLOQUE 1 - Renombrar filas vigentes de model_pricing_tiers
-- =============================================================

UPDATE model_pricing_tiers SET tier_code = 'T4' WHERE tier_code = 'T3';
UPDATE model_pricing_tiers SET tier_code = 'T3' WHERE tier_code = 'T2';
UPDATE model_pricing_tiers SET tier_code = 'T2' WHERE tier_code = 'T1';
UPDATE model_pricing_tiers SET tier_code = 'T1' WHERE tier_code = 'T0';

-- =============================================================
-- BLOQUE 2 - Renombrar snapshots historicos ya escritos
-- (columna denormalizada pricing_tier_code para lectura rapida)
-- =============================================================

UPDATE model_tier_daily_snapshots SET pricing_tier_code = 'T4' WHERE pricing_tier_code = 'T3';
UPDATE model_tier_daily_snapshots SET pricing_tier_code = 'T3' WHERE pricing_tier_code = 'T2';
UPDATE model_tier_daily_snapshots SET pricing_tier_code = 'T2' WHERE pricing_tier_code = 'T1';
UPDATE model_tier_daily_snapshots SET pricing_tier_code = 'T1' WHERE pricing_tier_code = 'T0';
