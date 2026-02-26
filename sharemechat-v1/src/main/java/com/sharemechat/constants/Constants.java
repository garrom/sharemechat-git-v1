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
        public static final String ADMIN = "ADMIN";

        private UserTypes() {}
    }

    public static class VerificationStatuses {
        public static final String PENDING = "PENDING";
        public static final String APPROVED = "APPROVED";
        public static final String REJECTED = "REJECTED";

        private VerificationStatuses() {}
    }

    public static class OperationTypes {
        public static final String STREAM_CHARGE = "STREAM_CHARGE";
        public static final String STREAM_EARNING = "STREAM_EARNING";

        private OperationTypes() {}
    }

    public static class KycModes {
        public static final String VERIFF = "VERIFF";
        public static final String MANUAL = "MANUAL";

        private KycModes() {}
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
        public static final String SPAM = "SPAM";
        public static final String OTHER = "OTHER";
        private ModerationReportTypes() {}
    }

}