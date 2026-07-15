-- V25: Cambiar invited='REFERRAL' -> 'accepted' en filas AFFILIATE_INVITATION.
--
-- Contexto: el commit anterior del mismo dia (4bd7d8f) aplico V24 con backfill
-- de las 4 filas reciprocas en favorites_clients heredando invited='REFERRAL'
-- de las filas originales de favorites_models (tambien 'REFERRAL' desde la
-- subpasada 2B del ADR-049, commit 70b5a5c del 12-jul).
--
-- Problema detectado 2026-07-15 tras el fix de reciprocidad: los clientes/modelos
-- referidos se veian mutuamente en favoritos pero NO podian chatear/enviar gifts/
-- hacer llamadas P2P entre si. Causa: 'invited' es un enum funcional (pending,
-- sent, accepted, rejected) usado por FavoriteService.canUsersMessage (backend)
-- y por filtros frontend (activeInteraction.js, DashboardClient.jsx, etc.) para
-- autorizar el chat P2P. Todos los guards filtran estrictamente por 'accepted'.
-- El valor 'REFERRAL' quedaba fuera y silenciaba el chat.
--
-- Fix del codigo: mismo commit cambia setInvited('REFERRAL') a setInvited('accepted')
-- en AffiliateAttributionService para ambas filas (favorites_models y
-- favorites_clients). Nuevos registros por referral ya no reproducen el bug.
--
-- La marca de origen se conserva intacta en favorite_source='AFFILIATE_INVITATION'
-- de favorites_models (columna canonica de trazabilidad economica del ADR-049).
--
-- Esta migracion normaliza las 8 filas existentes (4 en favorites_models + 4
-- reciprocas en favorites_clients) que tenian 'REFERRAL' antes del fix.
-- Idempotente: WHERE invited='REFERRAL' evita side effects si se re-ejecuta.

UPDATE favorites_models
   SET invited = 'accepted'
 WHERE favorite_source = 'AFFILIATE_INVITATION'
   AND invited = 'REFERRAL';

UPDATE favorites_clients fc
INNER JOIN favorites_models fm
        ON fm.model_id = fc.model_id
       AND fm.client_id = fc.client_id
       AND fm.favorite_source = 'AFFILIATE_INVITATION'
   SET fc.invited = 'accepted'
 WHERE fc.invited = 'REFERRAL';
