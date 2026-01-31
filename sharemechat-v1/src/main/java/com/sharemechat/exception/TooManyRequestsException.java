package com.sharemechat.exception;

public class TooManyRequestsException extends RuntimeException {

    private final long retryAfterMs;

    public TooManyRequestsException(String message, long retryAfterMs) {
        super(message);
        this.retryAfterMs = retryAfterMs;
    }

    public long getRetryAfterMs() {
        return retryAfterMs;
    }
}
