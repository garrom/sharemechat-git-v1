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

    public static class KycProviders {
        public static final String VERIFF = "VERIFF";
        public static final String MANUAL = "MANUAL";

        private KycProviders() {}
    }
}