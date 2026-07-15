-- V24: Backfill favorites_clients para registros AFFILIATE_INVITATION
--
-- Contexto: la Subpasada 2B del ADR-049 (commit 70b5a5c, 2026-07-12) introdujo
-- attributeReferralOnRegistration en AffiliateAttributionService. Ese metodo
-- creaba la fila del cliente en favorites_models con favorite_source=
-- 'AFFILIATE_INVITATION' pero se olvido de crear la fila reciproca en
-- favorites_clients. Resultado: el CLIENTE veia al modelo en su lista de
-- favoritos, pero el MODELO no veia al cliente en la suya.
--
-- Detectado 2026-07-15 al comparar en TEST: 41 filas MANUAL / 0 asimetricas,
-- pero 4 filas AFFILIATE_INVITATION / 4 asimetricas (100 %).
--
-- Fix del codigo: commit del mismo dia anyade favoriteClientRepository.save()
-- justo despues del save de la fila del cliente. Nuevo registro por referral
-- ya no reproduce la asimetria.
--
-- Esta migracion repara las 4 filas rotas actuales en TEST y las que hubiera
-- en AUDIT/PROD cuando se propaguen. Idempotente por el WHERE NOT EXISTS.

INSERT INTO favorites_clients (model_id, client_id, status, invited, created_at, updated_at)
SELECT fm.model_id, fm.client_id, 'active', 'REFERRAL', fm.created_at, fm.updated_at
FROM favorites_models fm
WHERE fm.favorite_source = 'AFFILIATE_INVITATION'
  AND NOT EXISTS (
      SELECT 1 FROM favorites_clients fc
      WHERE fc.model_id = fm.model_id AND fc.client_id = fm.client_id
  );
