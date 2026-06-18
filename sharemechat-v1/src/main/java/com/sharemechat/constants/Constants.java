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

        private Roles() {}
    }

    public static class UserTypes {
        public static final String FORM_CLIENT = "FORM_CLIENT";
        public static final String FORM_MODEL = "FORM_MODEL";
        public static final String INTERNAL = "INTERNAL";

        private UserTypes() {}
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
        public static final String NUDITY = "NUDITY";
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

}
