-- ADR-054 D8 Fase E (2026-08-07): amplia el CHECK constraint de
-- support_tickets.category para admitir 5 nuevas categorias propuestas
-- por el estudio de benchmark de plataformas cam (Chaturbate, Stripchat,
-- LiveJasmin, OnlyFans, Twitch, BongaCams). Ver bitacora entrada del
-- 2026-08-07 (Fase E) y docs/06-decisions/adr-054-sistema-tickets-incidencias.md.
--
-- Categorias nuevas:
--   PAYOUT_ISSUE          -> separa payout de modelo de charge de cliente
--                            (hoy PAYMENT_NOT_CREDITED mezcla ambos flujos)
--   KYC_VERIFICATION      -> reintentos Didit / age estimation / Master onboarding
--                            (ADR-058 age estimation + ADR-054 Master KYC generan
--                            este tipo de tickets sistematicamente)
--   ACCOUNT_SECURITY      -> 2FA, sospecha de acceso no autorizado, recuperacion
--                            de password, cuenta Google vinculada mal (ADR-058
--                            recien lanzado, pico previsible)
--   REFUND_REQUEST        -> flujo distinto de PAYMENT_NOT_CREDITED (refund al
--                            PSP con contabilidad y limite temporal)
--   ABUSE_REPORT          -> denuncia proactiva contra otro usuario (acoso,
--                            contenido ilegal, sospecha de menor, DMCA).
--                            Requisito DSA art. 16 notice-and-action.
--
-- MySQL 8.4 no permite ALTER CONSTRAINT en un CHECK — hay que DROP + ADD.

ALTER TABLE support_tickets DROP CONSTRAINT chk_ticket_category;

ALTER TABLE support_tickets ADD CONSTRAINT chk_ticket_category CHECK (category IN (
    'STREAM_INTERRUPTED',
    'PAYMENT_NOT_CREDITED',
    'MODERATION_FALSE_POSITIVE',
    'ACCOUNT_ISSUE',
    'PAYOUT_ISSUE',
    'KYC_VERIFICATION',
    'ACCOUNT_SECURITY',
    'REFUND_REQUEST',
    'ABUSE_REPORT',
    'OTHER'
));
