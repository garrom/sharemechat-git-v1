-- ============================================================
-- V4__add_model_asset_reviews.sql -- cola de moderacion de assets de modelo (Capa 1)
-- ============================================================
-- Capa 1 de moderacion de assets de perfil de modelo (1 foto + 1 video).
-- Antes de esta migracion, las URLs `url_pic` y `url_video` en
-- `model_documents` se servian al cliente inmediatamente tras la subida
-- sin pasar por aprobacion admin. Esta migracion introduce:
--
--   1. Tabla `model_asset_reviews`: cola de moderacion con historial
--      por (user, asset_type). Cada upload generara una row PENDING_REVIEW;
--      admin/support decide APPROVED o REJECTED. Estado independiente
--      de users.verification_status.
--
--   2. Flags denormalizados `pic_approved` y `video_approved` en
--      `model_documents`, mantenidos como invariante por
--      ModelAssetReviewService:
--        * create pending  -> flag a FALSE
--        * approve         -> flag a TRUE
--        * reject          -> flag a FALSE
--      Razon: las 5 queries de ModelDocumentRepository que filtran
--      "modelo visible al cliente" anadiran un AND sobre estos flags
--      sin tener que hacer JOIN a model_asset_reviews en cada listing.
--      MatchingHandlerSupport tambien se beneficia indirectamente.
--
--   3. Grandfather doble (paso 3): los modelos con
--      verification_status='APPROVED' al momento del despliegue se marcan
--      automaticamente como asset-aprobados para no romper su visibilidad:
--        * 1 fila APPROVED en model_asset_reviews por cada asset
--          existente (uploaded_at = md.created_at, reviewed_at = NOW(),
--          reviewer_id = NULL para senalar que fue grandfather y no
--          decision admin real).
--        * Flags pic_approved/video_approved = TRUE en model_documents.
--
-- Razon del cambio: riesgo de compliance / PSP — contenido del perfil
-- de modelo (foto, video) era visible sin moderacion. Capa 1 cierra el
-- riesgo para 1 foto + 1 video por modelo. Capa 2 (multi-asset, 5+2)
-- queda como deuda futura tras benchmark con competencia.
--
-- Schema audit log (`backoffice_access_audit_log`): NO se toca. El
-- ModelAssetReviewService escribira entries con action='ASSET_APPROVE'
-- o 'ASSET_REJECT' y metera resource_type/resource_id en payload_json
-- (decision D2 del operador).
--
-- Idempotencia: NO idempotente. Flyway garantiza ejecucion unica.
--
-- Ventana de mantenimiento: el backend debe estar parado durante la
-- aplicacion porque el JAR refactorizado (Capa 1) arranca con la
-- entidad ModelAssetReview y los filtros nuevos en las queries del
-- repositorio; aplicar este V4 con el JAR viejo dejaria flags y tabla
-- nuevas sin codigo que las mantenga. Procedimiento operativo:
-- aplicar migracion + arrancar JAR nuevo en el mismo despliegue.
-- ============================================================


-- ------------------------------------------------------------
-- Paso 1: crear tabla model_asset_reviews
-- ------------------------------------------------------------
CREATE TABLE model_asset_reviews (
    id                     BIGINT       NOT NULL AUTO_INCREMENT,
    user_id                BIGINT       NOT NULL,
    asset_type             VARCHAR(20)  NOT NULL,
    asset_url              VARCHAR(500) NOT NULL,
    status                 VARCHAR(20)  NOT NULL,
    rejection_reason_code  VARCHAR(50)  DEFAULT NULL,
    rejection_reason_text  VARCHAR(500) DEFAULT NULL,
    uploaded_at            DATETIME     NOT NULL,
    reviewed_at            DATETIME     DEFAULT NULL,
    reviewer_id            BIGINT       DEFAULT NULL,
    created_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_model_asset_reviews_status_uploaded (status, uploaded_at),
    KEY idx_model_asset_reviews_user (user_id),
    CONSTRAINT fk_model_asset_reviews_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_model_asset_reviews_reviewer
        FOREIGN KEY (reviewer_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_model_asset_reviews_asset_type
        CHECK (asset_type IN ('PIC','VIDEO')),
    CONSTRAINT chk_model_asset_reviews_status
        CHECK (status IN ('PENDING_REVIEW','APPROVED','REJECTED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- ------------------------------------------------------------
-- Paso 2: flags denormalizados en model_documents
-- ------------------------------------------------------------
-- BOOLEAN en MySQL = TINYINT(1). Default FALSE (0) para filas existentes;
-- el paso 3 (grandfather) los actualiza a TRUE para los modelos ya
-- aprobados con asset subido.
ALTER TABLE model_documents
    ADD COLUMN pic_approved   BOOLEAN NOT NULL DEFAULT FALSE AFTER url_pic,
    ADD COLUMN video_approved BOOLEAN NOT NULL DEFAULT FALSE AFTER url_video;

-- Indice compuesto para las 5 queries del repo que filtran
-- "modelo visible al cliente" (teasers, top, newest, random, count).
-- Combinacion final del WHERE en esas queries (post-cambio Capa 1):
--   u.role = 'MODEL'
--   AND u.verificationStatus = 'APPROVED'
--   AND md.urlVideo IS NOT NULL
--   AND md.pic_approved = TRUE
--   AND md.video_approved = TRUE
-- El indice acelera el descarte temprano de modelos con algun asset
-- pendiente o rechazado sin escanear la tabla completa de
-- model_documents.
ALTER TABLE model_documents
    ADD KEY idx_model_documents_approved_flags (pic_approved, video_approved);


-- ------------------------------------------------------------
-- Paso 3: grandfather de modelos ya aprobados al momento del deploy
-- ------------------------------------------------------------
-- 3.1 PIC: una fila APPROVED por modelo con url_pic presente
INSERT INTO model_asset_reviews
    (user_id, asset_type, asset_url, status, uploaded_at, reviewed_at, reviewer_id)
SELECT
    md.user_id,
    'PIC',
    md.url_pic,
    'APPROVED',
    COALESCE(md.created_at, NOW()),
    NOW(),
    NULL
FROM model_documents md
INNER JOIN users u ON u.id = md.user_id
WHERE u.verification_status = 'APPROVED'
  AND md.url_pic IS NOT NULL;

-- 3.2 VIDEO: una fila APPROVED por modelo con url_video presente
INSERT INTO model_asset_reviews
    (user_id, asset_type, asset_url, status, uploaded_at, reviewed_at, reviewer_id)
SELECT
    md.user_id,
    'VIDEO',
    md.url_video,
    'APPROVED',
    COALESCE(md.created_at, NOW()),
    NOW(),
    NULL
FROM model_documents md
INNER JOIN users u ON u.id = md.user_id
WHERE u.verification_status = 'APPROVED'
  AND md.url_video IS NOT NULL;

-- 3.3 Flag pic_approved = TRUE en model_documents
UPDATE model_documents md
INNER JOIN users u ON u.id = md.user_id
SET md.pic_approved = TRUE
WHERE u.verification_status = 'APPROVED'
  AND md.url_pic IS NOT NULL;

-- 3.4 Flag video_approved = TRUE en model_documents
UPDATE model_documents md
INNER JOIN users u ON u.id = md.user_id
SET md.video_approved = TRUE
WHERE u.verification_status = 'APPROVED'
  AND md.url_video IS NOT NULL;
