package com.sharemechat.dto;

public class VeriffCreateSessionResult {

    private final String sessionId;
    private final String verificationUrl;
    private final String vendorData;
    private final String rawResponseJson;

    public VeriffCreateSessionResult(String sessionId, String verificationUrl, String vendorData, String rawResponseJson) {
        this.sessionId = sessionId;
        this.verificationUrl = verificationUrl;
        this.vendorData = vendorData;
        this.rawResponseJson = rawResponseJson;
    }

    public String getSessionId() {
        return sessionId;
    }

    public String getVerificationUrl() {
        return verificationUrl;
    }

    public String getVendorData() {
        return vendorData;
    }

    public String getRawResponseJson() {
        return rawResponseJson;
    }
}