-- ============================================================
-- V11__add_complaints_schema.sql
-- ============================================================
-- Sub-paquete Complaints workflow (Opcion B) del frente compliance
-- (Mastercard AN 5196, Visa Rule ID 0003356, Segpay Adult Content
-- Checklist v2.0 §2.3, UE DSA art. 16-17, UK Online Safety Act).
--
-- Cubre canal publico anonimo de denuncias (no autenticado) separado
-- del flujo P2P interno (moderation_reports en V1) que sigue
-- intacto. Razon de separar: los compromisos publicos exigen SLA
-- explicito, audit log per-row, categorias regulatorias formales,
-- ack al denunciante y campos especificos para identificar contenido
-- sin conocer el user_id interno. Mezclar las dos colas en
-- moderation_reports complicaria las dos sin valor agregado.
--
-- Tablas creadas:
--   1. complaints              (1 fila por denuncia recibida; canal
--                               WEB/EMAIL/ADMIN; SLA 5 business days
--                               con expected_resolution_at fijado al
--                               crear; reporter puede ser anonimo si
--                               no facilita email)
--   2. complaint_audit_log     (1 fila por transicion de estado o
--                               accion administrativa; permite
--                               reconstruir la historia para
--                               auditoria Segpay/DSA)
--
-- Conexiones con frente existente:
--   - subject_user_id            FK opcional a users (admin lo rellena
--                                en revision si resuelve la identidad
--                                interna)
--   - subject_stream_record_id   FK opcional a stream_records (si la
--                                denuncia apunta a un stream concreto)
--   - related_moderation_report_id  FK opcional a moderation_reports
--                                (admin enlaza si duplica un report
--                                P2P interno existente)
--   - related_stream_review_id   FK opcional a stream_moderation_reviews
--                                (admin enlaza si abre review en
--                                cola humana del frente moderacion
--                                visual; NO se abre automaticamente,
--                                decision residual del admin)
--   - reviewed_by_user_id        FK a users (admin que reviso)
--
-- CHECK constraints sobre status, channel, category, decision_code
-- (no ENUM nativo MySQL, coherente con convencion V4/V10).
--
-- Charset/collation: utf8mb4 / utf8mb4_0900_ai_ci coherente con resto.
--
-- Idempotencia: NO idempotente. Flyway garantiza ejecucion unica.
-- ============================================================


-- ------------------------------------------------------------
-- Paso 1: complaints
-- ------------------------------------------------------------
CREATE TABLE complaints (
    id                              BIGINT       NOT NULL AUTO_INCREMENT,

    -- Denunciante (puede ser anonimo). reporter_ip_hash es SHA-256
    -- de la IP con salt fijo per-entorno (data minimization GDPR).
    reporter_email                  VARCHAR(255) DEFAULT NULL,
    reporter_name                   VARCHAR(255) DEFAULT NULL,
    reporter_ip_hash                VARCHAR(64)  DEFAULT NULL,

    -- Contenido reportado. category obligatorio, descripcion
    -- obligatoria, subject_* opcionales (denunciante externo no
    -- conoce id interno).
    category                        VARCHAR(40)  NOT NULL,
    description                     VARCHAR(2000) NOT NULL,
    subject_email                   VARCHAR(255) DEFAULT NULL,
    subject_url                     VARCHAR(2000) DEFAULT NULL,
    subject_user_id                 BIGINT       DEFAULT NULL,
    subject_stream_record_id        BIGINT       DEFAULT NULL,

    -- Workflow.
    status                          VARCHAR(20)  NOT NULL DEFAULT 'OPEN',
    channel                         VARCHAR(20)  NOT NULL DEFAULT 'WEB',

    -- SLA (5 business days desde created_at, calculados por servicio
    -- al crear saltando sabado/domingo).
    created_at                      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at                 DATETIME     DEFAULT NULL,
    expected_resolution_at          DATETIME     DEFAULT NULL,
    resolved_at                     DATETIME     DEFAULT NULL,
    sla_breach_at                   DATETIME     DEFAULT NULL,

    -- Resolucion.
    decision_code                   VARCHAR(40)  DEFAULT NULL,
    decision_notes                  VARCHAR(2000) DEFAULT NULL,
    reviewed_by_user_id             BIGINT       DEFAULT NULL,

    -- Vinculos opcionales con frentes existentes.
    related_moderation_report_id    BIGINT       DEFAULT NULL,
    related_stream_review_id        BIGINT       DEFAULT NULL,

    updated_at                      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_complaint_status (status),
    KEY idx_complaint_category (category),
    KEY idx_complaint_sla (expected_resolution_at, status),
    KEY idx_complaint_subject_user (subject_user_id),
    KEY idx_complaint_subject_stream (subject_stream_record_id),
    KEY idx_complaint_created (created_at),

    CONSTRAINT fk_complaint_subject_user
        FOREIGN KEY (subject_user_id) REFERENCES users (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_complaint_subject_stream
        FOREIGN KEY (subject_stream_record_id) REFERENCES stream_records (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_complaint_reviewed_by
        FOREIGN KEY (reviewed_by_user_id) REFERENCES users (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_complaint_related_moderation_report
        FOREIGN KEY (related_moderation_report_id) REFERENCES moderation_reports (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_complaint_related_stream_review
        FOREIGN KEY (related_stream_review_id) REFERENCES stream_moderation_reviews (id)
        ON DELETE SET NULL ON UPDATE CASCADE,

    CONSTRAINT chk_complaint_status
        CHECK (status IN ('OPEN','ACKNOWLEDGED','REVIEWING','RESOLVED','REJECTED','ESCALATED')),
    CONSTRAINT chk_complaint_channel
        CHECK (channel IN ('WEB','EMAIL','ADMIN')),
    CONSTRAINT chk_complaint_category
        CHECK (category IN ('CSAM','NON_CONSENSUAL','MINOR_AT_RISK','HATE_SYMBOLS',
                             'COPYRIGHT','ILLEGAL','HARASSMENT','IMPERSONATION',
                             'FRAUD','OTHER')),
    CONSTRAINT chk_complaint_decision_code
        CHECK (decision_code IS NULL OR decision_code IN
            ('CONTENT_REMOVED','USER_SUSPENDED','USER_BANNED','NO_ACTION',
             'INSUFFICIENT_INFO','ESCALATED_TO_AUTHORITIES','FORWARDED_TO_NCMEC'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- ------------------------------------------------------------
-- Paso 2: complaint_audit_log
-- (Transiciones de status + acciones admin para auditoria Segpay/DSA)
-- ------------------------------------------------------------
CREATE TABLE complaint_audit_log (
    id                  BIGINT       NOT NULL AUTO_INCREMENT,
    complaint_id        BIGINT       NOT NULL,
    actor_user_id       BIGINT       DEFAULT NULL,  -- NULL = sistema
    action              VARCHAR(40)  NOT NULL,
    from_status         VARCHAR(20)  DEFAULT NULL,
    to_status           VARCHAR(20)  DEFAULT NULL,
    notes               VARCHAR(1000) DEFAULT NULL,
    created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_cal_complaint (complaint_id, created_at),
    KEY idx_cal_action (action),
    CONSTRAINT fk_cal_complaint
        FOREIGN KEY (complaint_id) REFERENCES complaints (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_cal_actor_user
        FOREIGN KEY (actor_user_id) REFERENCES users (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_cal_action
        CHECK (action IN ('CREATED','ACK_SENT','STATUS_CHANGED','NOTE_ADDED',
                          'DECISION','ESCALATED','EVIDENCE_UPLOADED','ADMIN_ALERT_SENT'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
