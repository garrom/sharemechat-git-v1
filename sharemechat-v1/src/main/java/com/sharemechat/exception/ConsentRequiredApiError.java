package com.sharemechat.exception;

import java.time.LocalDateTime;

public class ConsentRequiredApiError {

    private final LocalDateTime timestamp = LocalDateTime.now();
    private final int status;
    private final String error;
    private final String message;
    private final String path;
    private final String code;
    private final String requiredTermsVersion;
    private final String reasonCode;

    public ConsentRequiredApiError(int status,
                                   String error,
                                   String message,
                                   String path,
                                   String code,
                                   String requiredTermsVersion,
                                   String reasonCode) {
        this.status = status;
        this.error = error;
        this.message = message;
        this.path = path;
        this.code = code;
        this.requiredTermsVersion = requiredTermsVersion;
        this.reasonCode = reasonCode;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public int getStatus() {
        return status;
    }

    public String getError() {
        return error;
    }

    public String getMessage() {
        return message;
    }

    public String getPath() {
        return path;
    }

    public String getCode() {
        return code;
    }

    public String getRequiredTermsVersion() {
        return requiredTermsVersion;
    }

    public String getReasonCode() {
        return reasonCode;
    }
}
