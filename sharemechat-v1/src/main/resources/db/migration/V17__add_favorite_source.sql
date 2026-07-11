-- Subpasada 2B del sistema de afiliadas (ADR-049).
-- Amplia `favorites_models` con la columna `favorite_source` para
-- trazar el origen del favorito. Origenes soportados:
--   * MANUAL              — el cliente pulso el CTA "favorito" en la UI.
--   * AFFILIATE_INVITATION — el favorito lo inserto automaticamente
--                            `AffiliateAttributionService` durante el
--                            registro del cliente atribuido a la modelo
--                            referidora (ADR-049 D6).
--
-- Semantica del favorito auto de AFFILIATE_INVITATION: se inserta
-- directamente con `status='active'` + `invited='REFERRAL'`, sin pasar
-- por el flujo bidireccional (`sent`/`pending`) del `FavoriteService`.
-- Es un favorito "de bienvenida" del cliente hacia la modelo referidora;
-- la relacion mutua se puede completar cuando la modelo acepte la
-- invitacion desde su panel (flujo estandar existente).
--
-- El default MANUAL preserva compatibilidad hacia atras: cualquier fila
-- previa a esta migracion queda `MANUAL` sin necesidad de tocar nada.

ALTER TABLE favorites_models
    ADD COLUMN favorite_source VARCHAR(30) NOT NULL DEFAULT 'MANUAL'
        COMMENT 'Origen del favorito: MANUAL (CTA del cliente) o AFFILIATE_INVITATION (primer favorito auto por afiliacion, ADR-049 D6).';

ALTER TABLE favorites_models
    ADD CONSTRAINT chk_fav_models_source CHECK (
        favorite_source IN ('MANUAL', 'AFFILIATE_INVITATION')
    );

CREATE INDEX idx_fav_models_source ON favorites_models (favorite_source);
