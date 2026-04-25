package com.sharemechat.constants;

public final class AuthRiskConstants {

    private AuthRiskConstants() {
    }

    public static final class Events {
        private Events() {
        }

        public static final String LOGIN_ATTEMPT = "LOGIN_ATTEMPT";
        public static final String LOGIN_SUCCESS = "LOGIN_SUCCESS";
        public static final String LOGIN_FAILURE = "LOGIN_FAILURE";
    }

    public static final class Levels {
        private Levels() {
        }

        public static final String NORMAL = "NORMAL";
        public static final String SUSPICIOUS = "SUSPICIOUS";
        public static final String HIGH = "HIGH";
        public static final String CRITICAL = "CRITICAL";
    }

    public static final class Channels {
        private Channels() {
        }

        public static final String PRODUCT = "product";
    }

    public static final class Reasons {
        private Reasons() {
        }

        public static final String TEMPORAL_BLOCK_ACTIVE = "temporal_block_active";
    }

    public static final class Keys {
        private Keys() {
        }

        public static final String LOGIN_BLOCK_EMAIL_PREFIX = "login:block:email:";
    }
}