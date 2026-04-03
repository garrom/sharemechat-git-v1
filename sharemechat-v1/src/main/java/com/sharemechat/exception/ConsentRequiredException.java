package com.sharemechat.exception;

import com.sharemechat.consent.ConsentState;

public class ConsentRequiredException extends RuntimeException {

    private final Long userId;
    private final String endpointKey;
    private final ConsentState consentState;

    public ConsentRequiredException(Long userId, String endpointKey, ConsentState consentState) {
        super("Consentimiento obligatorio pendiente");
        this.userId = userId;
        this.endpointKey = endpointKey;
        this.consentState = consentState;
    }

    public Long getUserId() {
        return userId;
    }

    public String getEndpointKey() {
        return endpointKey;
    }

    public ConsentState getConsentState() {
        return consentState;
    }
}
