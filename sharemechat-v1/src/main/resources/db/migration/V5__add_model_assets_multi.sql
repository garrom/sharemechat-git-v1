-- ============================================================
-- V5__add_model_assets_multi.sql -- Capa 2 multi-asset (5 fotos + 2 videos por modelo)
-- ============================================================
-- Migracion estructural de Capa 1 -> Capa 2 del flujo de moderacion
-- de assets de perfil de modelo.
--
-- Capa 1 (V4): 1 foto + 1 video por modelo, almacenados como `url_pic`
-- y `url_video` directamente en `model_documents`, con flags
-- denormalizados `pic_approved` / `video_approved` mantenidos por
-- ModelAssetReviewService. Defectos detectados:
--
--   1. Bug de filtrado parcial: el matching pool y otras superficies
--      que leen `url_pic`/`url_video` directamente no respetan los
--      flags de aprobacion -> foto pendiente visible al cliente.
--   2. Modelo de datos rigido: no escala a galerias con varios assets
--      por modelo (negocio pide hasta 5 fotos + 2 videos).
--   3. Acoplamiento: ModelDocument mezcla KYC docs (front/back/doc)
--      con assets de perfil publico (pic/video). Conceptos distintos.
--
-- Capa 2 (este V5):
--
--   * Tabla nueva `model_assets`: una fila por asset, con FK a `users`,
--     tipo (`PIC` | `VIDEO`), URL, flags `is_principal` (la principal
--     que se muestra primero al cliente), `is_active` (soft delete) y
--     `position` (orden en galeria).
--   * Tabla `model_asset_reviews` recibe columna nueva `asset_id` FK
--     a `model_assets` para vincular cada review con el asset concreto
--     (en Capa 1 la review apuntaba al user + tipo, sin distinguir
--     entre assets del mismo tipo).
--   * Grandfather: las URLs actuales `url_pic` / `url_video` de cada
--     modelo en `model_documents` se migran como assets `is_principal=
--     TRUE` con `position=0` (el "principal" actual de Capa 1 es el
--     unico, asi que es trivialmente el principal post-Capa 2). Los
--     reviews existentes en `model_asset_reviews` se vinculan a su
--     asset por match (user_id + asset_type + url).
--   * Cleanup: se eliminan `url_pic`, `url_video`, `pic_approved`,
--     `video_approved` de `model_documents`. Las queries del repo
--     pasaran a leer `model_assets` (en Fase 2 del backend; este V5
--     solo cambia el schema).
--
-- Comportamiento del grandfather con reviews historicas: las reviews
-- cuyo `asset_url` ya no corresponde con `url_pic`/`url_video` actual
-- (porque el modelo subio asset nuevo y el viejo fue sobrescrito en
-- `model_documents`) quedaran con `asset_id = NULL`. Su rastro
-- (status, reviewer_id, fechas, asset_url snapshot) se conserva como
-- traza historica auditable; el asset fisico al que apuntaban ya no
-- existe en storage (deleteByPublicUrl en upload reemplaza el blob).
--
-- Comportamiento de las queries Capa 1 tras este V5: las 5 queries de
-- ModelDocumentRepository que filtraban por `md.pic_approved=true AND
-- md.video_approved=true` fallaran al arrancar porque las columnas ya
-- no existiran. ESTE V5 NO debe aplicarse sin acompanar al JAR de
-- Fase 2 que tiene las queries refactorizadas para usar `model_assets`.
-- Procedimiento operativo coordinado en Fase 6 del paquete Capa 2.
--
-- Idempotencia: NO idempotente. Flyway garantiza ejecucion unica.
-- ============================================================


-- ------------------------------------------------------------
-- Paso 1: crear tabla model_assets
-- ------------------------------------------------------------
CREATE TABLE model_assets (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    user_id       BIGINT       NOT NULL,
    asset_type    VARCHAR(20)  NOT NULL,
    url           VARCHAR(500) NOT NULL,
    is_principal  BOOLEAN      NOT NULL DEFAULT FALSE,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    position      INT          NOT NULL DEFAULT 0,
    uploaded_at   DATETIME     NOT NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_model_assets_user_type (user_id, asset_type),
    INDEX idx_model_assets_user_principal (user_id, asset_type, is_principal),
    CONSTRAINT fk_model_assets_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_model_assets_asset_type
        CHECK (asset_type IN ('PIC','VIDEO'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- ------------------------------------------------------------
-- Paso 2: anadir asset_id a model_asset_reviews
-- ------------------------------------------------------------
-- Vincula cada review con el asset concreto que estaba revisando.
-- ON DELETE SET NULL: si el asset se borra fisicamente (cleanup
-- operativo), la review se conserva como traza historica con
-- asset_id=NULL.
ALTER TABLE model_asset_reviews
    ADD COLUMN asset_id BIGINT NULL AFTER asset_url,
    ADD CONSTRAINT fk_mar_asset
        FOREIGN KEY (asset_id) REFERENCES model_assets (id) ON DELETE SET NULL;


-- ------------------------------------------------------------
-- Paso 3: grandfather PIC (model_documents.url_pic -> model_assets)
-- ------------------------------------------------------------
-- Una fila is_principal=TRUE position=0 por modelo con foto subida.
-- En Capa 1 cada modelo tenia 1 sola foto; en Capa 2 esa unica foto
-- pasa a ser la principal trivialmente.
INSERT INTO model_assets
    (user_id, asset_type, url, is_principal, is_active, position, uploaded_at)
SELECT
    md.user_id,
    'PIC',
    md.url_pic,
    TRUE,
    TRUE,
    0,
    COALESCE(md.created_at, NOW())
FROM model_documents md
WHERE md.url_pic IS NOT NULL;


-- ------------------------------------------------------------
-- Paso 4: grandfather VIDEO
-- ------------------------------------------------------------
INSERT INTO model_assets
    (user_id, asset_type, url, is_principal, is_active, position, uploaded_at)
SELECT
    md.user_id,
    'VIDEO',
    md.url_video,
    TRUE,
    TRUE,
    0,
    COALESCE(md.created_at, NOW())
FROM model_documents md
WHERE md.url_video IS NOT NULL;


-- ------------------------------------------------------------
-- Paso 5: vincular reviews existentes a su asset_id
-- ------------------------------------------------------------
-- Match por (user_id, asset_type, url). Las reviews cuyo asset_url
-- ya no coincide con la url actual en model_documents (porque el
-- modelo subio una version mas reciente sobre la misma columna)
-- quedan con asset_id=NULL: el asset al que apuntaban ya no existe
-- y no hay row equivalente en model_assets para vincular. Esto es
-- comportamiento esperado del grandfather y preserva la traza
-- historica de quien aprobo/rechazo asset_url X en su momento.
UPDATE model_asset_reviews mar
JOIN model_assets ma
    ON ma.user_id = mar.user_id
   AND ma.asset_type = mar.asset_type
   AND ma.url = mar.asset_url
SET mar.asset_id = ma.id;


-- ------------------------------------------------------------
-- Paso 6: eliminar columnas deprecated de model_documents
-- ------------------------------------------------------------
-- La fuente de verdad de los assets de perfil pasa a `model_assets`.
-- `model_documents` mantiene su responsabilidad original (KYC docs:
-- url_verific_front/back/doc + url_consent + timestamps).
--
-- Nota operativa go-live PROD (anotada en known-debt 2026-05-30):
-- con tabla grande considerar ALGORITHM=INPLACE explicito + ventana
-- de mantenimiento. En AUDIT (3 filas) es irrelevante.
ALTER TABLE model_documents
    DROP COLUMN url_pic,
    DROP COLUMN url_video,
    DROP COLUMN pic_approved,
    DROP COLUMN video_approved;
