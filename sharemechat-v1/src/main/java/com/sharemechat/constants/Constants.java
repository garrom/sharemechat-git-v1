package com.sharemechat.constants;

public class Constants {
    public static class Roles {
        public static final String USER = "USER";
        public static final String CLIENT = "CLIENT";
        public static final String MODEL = "MODEL";
        public static final String ADMIN = "ADMIN";
    }

    public static class UserTypes {
        public static final String FORM_CLIENT = "FORM_CLIENT";
        public static final String FORM_MODEL = "FORM_MODEL";
        public static final String ADMIN = "ADMIN";
    }

    public static class VerificationStatuses {
        public static final String PENDING = "PENDING";
        public static final String APPROVED = "APPROVED";
        public static final String REJECTED = "REJECTED";
    }

    public static class OperationTypes {
        public static final String STREAM_CHARGE = "STREAM_CHARGE";   // cargo al cliente
        public static final String STREAM_EARNING = "STREAM_EARNING"; // ingreso a la modelo
    }
}