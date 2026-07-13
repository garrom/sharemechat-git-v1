package com.sharemechat.constants;

public class Constants {

    private Constants() {
        // utility class
    }

    public static class Roles {
        public static final String USER = "USER";
        public static final String CLIENT = "CLIENT";
        public static final String MODEL = "MODEL";
        public static final String ADMIN = "ADMIN";
        // Sub-paquete Chat Soporte LLM Fase B.1 (DEC-CS-9): rol especial del
        // bot conversacional. NO se le concede acceso a endpoints protegidos.
        // Solo existe como user pasivo en users + como peer favorito.
        public static final String SUPPORT_BOT = "SUPPORT_BOT";

        private Roles() {}
    }

    public static class UserTypes {
        public static final String FORM_CLIENT = "FORM_CLIENT";
        public static final String FORM_MODEL = "FORM_MODEL";
        public static final String INTERNAL = "INTERNAL";
        public static final String BOT = "BOT";

        private UserTypes() {}
    }

    /**
     * Sub-paquete Chat Soporte LLM (DEC-CS-3, DEC-CS-11).
     * Estados de resolucion de una support_conversations.
     */
    public static class SupportResolutionStatuses {
        public static final String OPEN = "OPEN";
        public static final String RESOLVED = "RESOLVED";
        public static final String ESCALATED = "ESCALATED";
        public static final String ABANDONED = "ABANDONED";
        public static final String RATE_LIMITED = "RATE_LIMITED";
        // Frente B.3.1 (ADR-046): un agente humano ha hecho claim sobre la
        // conversacion escalada. Coexiste con ESCALATED (ESCALATED sin claim,
        // HUMAN_HANDLING con claim activo). El bot deja de responder.
        public static final String HUMAN_HANDLING = "HUMAN_HANDLING";

        private SupportResolutionStatuses() {}
    }

    /**
     * Sub-paquete Chat Soporte LLM. Sender de una support_messages.
     */
    public static class SupportSenderTypes {
        public static final String USER = "USER";
        public static final String LLM = "LLM";
        public static final String HUMAN = "HUMAN";
        public static final String SYSTEM = "SYSTEM";

        private SupportSenderTypes() {}
    }

    public static class VerificationStatuses {
        public static final String PENDING = "PENDING";
        public static final String APPROVED = "APPROVED";
        public static final String REJECTED = "REJECTED";

        private VerificationStatuses() {}
    }

    public static class AccountStatuses {
        public static final String ACTIVE = "ACTIVE";
        public static final String SUSPENDED = "SUSPENDED";
        public static final String BANNED = "BANNED";

        private AccountStatuses() {}
    }

    public static class OperationTypes {
        public static final String STREAM_CHARGE = "STREAM_CHARGE";
        public static final String STREAM_EARNING = "STREAM_EARNING";
        public static final String MANUAL_REFUND = "MANUAL_REFUND";
        public static final String MANUAL_REFUND_EXPENSE = "MANUAL_REFUND_EXPENSE";
        // BFPM (ADR-012): bonus de minutos financiado por la plataforma.
        // BONUS_GRANT  → cliente recibe EUR equivalente a los minutos extra concedidos.
        // BONUS_FUNDING → plataforma asume contablemente el coste del bonus (importe negativo).
        public static final String BONUS_GRANT = "BONUS_GRANT";
        public static final String BONUS_FUNDING = "BONUS_FUNDING";
        // ADR-049 Subpasada 2B: bono de bienvenida referral (D7). Mismo patron
        // BFPM: REFERRAL_WELCOME_GRANT en el ledger cliente (+10 EUR) y
        // REFERRAL_WELCOME_FUNDING en el ledger plataforma (-10 EUR). Invariante
        // Sum(GRANT) + Sum(FUNDING) = 0. Idempotencia por cliente via query
        // existsByUserIdAndOperationType(clientId, REFERRAL_WELCOME_GRANT).
        public static final String REFERRAL_WELCOME_GRANT = "REFERRAL_WELCOME_GRANT";
        public static final String REFERRAL_WELCOME_FUNDING = "REFERRAL_WELCOME_FUNDING";

        private OperationTypes() {}
    }

    public static class StreamTypes {
        public static final String UNKNOWN = "UNKNOWN";
        public static final String RANDOM = "RANDOM";
        public static final String CALLING = "CALLING";

        private StreamTypes() {}
    }

    public static class StreamEventTypes {
        public static final String CREATED = "CREATED";
        public static final String CONFIRMED = "CONFIRMED";
        public static final String BILLING_STARTED = "BILLING_STARTED";
        public static final String ENDED = "ENDED";
        public static final String CUT_LOW_BALANCE = "CUT_LOW_BALANCE";
        public static final String DISCONNECT = "DISCONNECT";
        public static final String TIMEOUT = "TIMEOUT";

        private StreamEventTypes() {}
    }

    public static class KycModes {
        public static final String VERIFF = "VERIFF";
        public static final String MANUAL = "MANUAL";
        // ADR-035 (2026-06-13): Didit es vendor unico Plan A. VERIFF queda
        // dormido pero integrado como contingencia tecnica.
        public static final String DIDIT = "DIDIT";

        private KycModes() {}
    }

    public static class SessionTypes {
        // Tipos de sesion KYC en kyc_sessions.session_type (V9, frente Didit
        // cliente). MODEL son las sesiones Document+Selfie+Liveness del
        // modelo; CLIENT son las de Age Estimation del cliente. La columna
        // tiene DEFAULT 'MODEL', asi que las filas historicas (anteriores
        // a V9) quedan MODEL automaticamente.
        public static final String MODEL = "MODEL";
        public static final String CLIENT = "CLIENT";

        private SessionTypes() {}
    }

    public static class ModerationReportStatuses {
        public static final String OPEN = "OPEN";
        public static final String REVIEWING = "REVIEWING";
        public static final String RESOLVED = "RESOLVED";
        public static final String REJECTED = "REJECTED";

        private ModerationReportStatuses() {}
    }

    public static class ModerationAdminActions {
        public static final String NONE = "NONE";
        public static final String WARNING = "WARNING";
        public static final String SUSPEND = "SUSPEND";
        public static final String BAN = "BAN";

        private ModerationAdminActions() {}
    }

    public static class ModerationReportTypes {
        public static final String ABUSE = "ABUSE";
        public static final String HARASSMENT = "HARASSMENT";
        // NUDITY retirado del set P2P en sub-paquete Complaints workflow (Opcion B,
        // DEC-3): contradice el posicionamiento adult dating intimate confirmado en
        // P2.2. Cero filas en BD usaban NUDITY al cierre. Las denuncias publicas
        // (regulatorias) viven en la tabla complaints (V11), no en moderation_reports.
        public static final String FRAUD = "FRAUD";
        public static final String MINOR = "MINOR";
        public static final String OTHER = "OTHER";

        private ModerationReportTypes() {}
    }

    // ========================================================================
    // Frente Moderacion IA del streaming (ADR-030 / ADR-036 / ADR-037).
    // Valores canonicos del dominio stream_moderation_*. Vendor-agnostic:
    // los nombres de vendor solo aparecen como valores literales en
    // StreamModerationProvider y en config (moderation.<vendor>.*).
    // ========================================================================

    public static class StreamModerationProvider {
        public static final String MOCK = "MOCK";
        public static final String SIGHTENGINE = "SIGHTENGINE";
        public static final String HIVE = "HIVE";
        public static final String REKOGNITION = "REKOGNITION";

        private StreamModerationProvider() {}
    }

    public static class StreamModerationSessionStatus {
        public static final String ACTIVE = "ACTIVE";
        public static final String STOPPED = "STOPPED";
        public static final String ERROR = "ERROR";
        public static final String DEGRADED = "DEGRADED";

        private StreamModerationSessionStatus() {}
    }

    public static class StreamModerationSamplingStrategy {
        public static final String INTERVAL = "INTERVAL";
        public static final String EVENT = "EVENT";
        public static final String HYBRID = "HYBRID";

        private StreamModerationSamplingStrategy() {}
    }

    public static class StreamModerationEventType {
        public static final String VERDICT_RECEIVED = "VERDICT_RECEIVED";
        public static final String VERDICT_TIMEOUT = "VERDICT_TIMEOUT";
        public static final String VERDICT_ERROR = "VERDICT_ERROR";
        public static final String WEBHOOK_RECEIVED = "WEBHOOK_RECEIVED";

        private StreamModerationEventType() {}
    }

    public static class StreamModerationReviewStatus {
        public static final String PENDING = "PENDING";
        public static final String IN_REVIEW = "IN_REVIEW";
        public static final String APPROVED = "APPROVED";
        public static final String REJECTED = "REJECTED";
        public static final String CANCELLED = "CANCELLED";

        private StreamModerationReviewStatus() {}
    }

    public static class StreamModerationSeverity {
        public static final String GREEN = "GREEN";
        public static final String AMBER = "AMBER";
        public static final String RED = "RED";
        public static final String CRITICAL = "CRITICAL";

        private StreamModerationSeverity() {}
    }

    public static class StreamModerationCategory {
        public static final String NUDITY = "NUDITY";
        public static final String WEAPONS = "WEAPONS";
        public static final String DRUGS = "DRUGS";
        public static final String VIOLENCE = "VIOLENCE";
        public static final String GORE = "GORE";
        public static final String SELF_HARM = "SELF_HARM";
        public static final String GAMBLING = "GAMBLING";
        public static final String OFFENSIVE_SYMBOLS = "OFFENSIVE_SYMBOLS";
        public static final String MINORS = "MINORS";
        public static final String OTHER = "OTHER";

        private StreamModerationCategory() {}
    }

    public static class StreamModerationProviderKeys {
        public static final String STREAM_VISUAL_MODERATION = "STREAM_VISUAL_MODERATION";

        private StreamModerationProviderKeys() {}
    }

    // ========================================================================
    // Sub-paquete Complaints workflow (Opcion B). Canal publico anonimo de
    // denuncias regulatorias. Tabla complaints (V11). Vendor-agnostic.
    // ========================================================================

    public static class ComplaintCategories {
        public static final String CSAM = "CSAM";
        public static final String NON_CONSENSUAL = "NON_CONSENSUAL";
        public static final String MINOR_AT_RISK = "MINOR_AT_RISK";
        public static final String HATE_SYMBOLS = "HATE_SYMBOLS";
        public static final String COPYRIGHT = "COPYRIGHT";
        public static final String ILLEGAL = "ILLEGAL";
        public static final String HARASSMENT = "HARASSMENT";
        public static final String IMPERSONATION = "IMPERSONATION";
        public static final String FRAUD = "FRAUD";
        public static final String OTHER = "OTHER";

        private ComplaintCategories() {}
    }

    public static class ComplaintStatuses {
        public static final String OPEN = "OPEN";
        public static final String ACKNOWLEDGED = "ACKNOWLEDGED";
        public static final String REVIEWING = "REVIEWING";
        public static final String RESOLVED = "RESOLVED";
        public static final String REJECTED = "REJECTED";
        public static final String ESCALATED = "ESCALATED";

        private ComplaintStatuses() {}
    }

    public static class ComplaintChannels {
        public static final String WEB = "WEB";
        public static final String EMAIL = "EMAIL";
        public static final String ADMIN = "ADMIN";

        private ComplaintChannels() {}
    }

    public static class ComplaintDecisionCodes {
        public static final String CONTENT_REMOVED = "CONTENT_REMOVED";
        public static final String USER_SUSPENDED = "USER_SUSPENDED";
        public static final String USER_BANNED = "USER_BANNED";
        public static final String NO_ACTION = "NO_ACTION";
        public static final String INSUFFICIENT_INFO = "INSUFFICIENT_INFO";
        public static final String ESCALATED_TO_AUTHORITIES = "ESCALATED_TO_AUTHORITIES";
        public static final String FORWARDED_TO_NCMEC = "FORWARDED_TO_NCMEC";

        private ComplaintDecisionCodes() {}
    }

    public static class ComplaintAuditActions {
        public static final String CREATED = "CREATED";
        public static final String ACK_SENT = "ACK_SENT";
        public static final String STATUS_CHANGED = "STATUS_CHANGED";
        public static final String NOTE_ADDED = "NOTE_ADDED";
        public static final String DECISION = "DECISION";
        public static final String ESCALATED = "ESCALATED";
        public static final String EVIDENCE_UPLOADED = "EVIDENCE_UPLOADED";
        public static final String ADMIN_ALERT_SENT = "ADMIN_ALERT_SENT";

        private ComplaintAuditActions() {}
    }

    /**
     * Actions del sub-paquete Compliance Dashboard (DEC-CD-A, DEC-CD-3).
     * Se persisten en backoffice_access_audit_log para auditoria externa
     * (Segpay/CCBill) y deteccion de uso indebido del panel.
     */
    public static class ComplianceAuditActions {
        /** Cambio enforcement del estado de cuenta de usuario (SUSPENDED/BANNED/ACTIVE). */
        public static final String USER_ACCOUNT_STATUS_CHANGE = "USER_ACCOUNT_STATUS_CHANGE";
        /** Acceso a una imagen evidencia via signed URL temporal. */
        public static final String COMPLIANCE_EVIDENCE_ACCESS = "COMPLIANCE_EVIDENCE_ACCESS";
        /** Hit al dashboard ejecutivo (opcional, no se usa hoy; reservado). */
        public static final String COMPLIANCE_DASHBOARD_VIEW = "COMPLIANCE_DASHBOARD_VIEW";

        private ComplianceAuditActions() {}
    }

    // ========================================================================
    // Programa de afiliadas de modelos (ADR-049). D2 revisado 2026-07-12:
    // la comision se acumula al STREAM_CHARGE (consumo per-second), no al
    // SUCCESS de PaymentSession (recarga). El esquema soporta multiples
    // fuentes via source_type/source_id.
    // ========================================================================

    /**
     * Discriminador de fuente que dispara la comision de afiliada.
     * Valores usados en fase actual: {@link #STREAM_CHARGE}. Reservados
     * para futuros hooks: {@link #PAYMENT_SESSION}.
     */
    public static class AffiliateCommissionSourceType {
        public static final String STREAM_CHARGE = "STREAM_CHARGE";
        public static final String PAYMENT_SESSION = "PAYMENT_SESSION";

        private AffiliateCommissionSourceType() {}
    }

    /**
     * Estados posibles de la fila {@code affiliate_commissions}. El flujo
     * actual (D2 revisado) usa {@link #PAYABLE} / {@link #SKIPPED_NO_ACTIVITY}
     * directamente sin pasar por {@link #ACCRUED}; este ultimo queda
     * reservado para futuros flujos con hold retention (PSP tarjeta).
     */
    public static class AffiliateCommissionStatus {
        public static final String ACCRUED = "ACCRUED";
        public static final String PAYABLE = "PAYABLE";
        public static final String SKIPPED_NO_ACTIVITY = "SKIPPED_NO_ACTIVITY";
        public static final String REVERSED_CHARGEBACK = "REVERSED_CHARGEBACK";
        public static final String PAID = "PAID";

        private AffiliateCommissionStatus() {}
    }

    // ========================================================================
    // Anti-fraude camara Fase B (ADR-050): liveness challenge con SightEngine
    // face-attributes antes del primer startMatch del dia.
    // ========================================================================

    /**
     * ADR-050 D4 (revisado 2026-07-13): tipo de challenge activo.
     *
     * <p>Historia: el D4 original definia {@code BLINK/TURN_LEFT/TURN_RIGHT/
     * SMILE} con verify basado en scores de face-attributes. El testing
     * empirico con Logitech C270 mostro tasas de falso negativo altas por
     * calibracion sensible del vendor + iluminacion de casa. Se cambio a
     * {@link #PRESENCE} (mira 3s, backend valida face+micro-movement) que
     * es el modelo pasivo de CooMeet y el resto del vertical.
     *
     * <p>Los constantes de los tipos viejos se conservan para retrocompat
     * con filas historicas ya persistidas, pero {@code LivenessChallengeService}
     * ya solo emite {@code PRESENCE}.
     */
    public static class LivenessChallengeType {
        public static final String PRESENCE = "PRESENCE";
        // Legacy (no emitidos por el service tras 2026-07-13):
        public static final String BLINK = "BLINK";
        public static final String TURN_LEFT = "TURN_LEFT";
        public static final String TURN_RIGHT = "TURN_RIGHT";
        public static final String SMILE = "SMILE";

        private LivenessChallengeType() {}
    }

    /**
     * ADR-050 D4/D5: estados de {@code liveness_attempts.status}.
     * Transicion: PENDING -> PASSED | FAILED | EXPIRED.
     */
    public static class LivenessChallengeStatus {
        public static final String PENDING = "PENDING";
        public static final String PASSED = "PASSED";
        public static final String FAILED = "FAILED";
        public static final String EXPIRED = "EXPIRED";

        private LivenessChallengeStatus() {}
    }
}
