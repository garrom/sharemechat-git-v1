package com.sharemechat.exception;

public class EmailVerificationRequiredException extends RuntimeException {

    public static final String CODE = "EMAIL_NOT_VERIFIED";

    private final String scope;
    private final String nextAction;

    public EmailVerificationRequiredException(String message) {
        this(message, null, null);
    }

    public EmailVerificationRequiredException(String message, String scope, String nextAction) {
        super(message);
        this.scope = scope;
        this.nextAction = nextAction;
    }

    public String getCode() {
        return CODE;
    }

    public String getScope() {
        return scope;
    }

    public String getNextAction() {
        return nextAction;
    }
}
