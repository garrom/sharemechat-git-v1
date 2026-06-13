package com.sharemechat.dto;

public class DiditCreateSessionResult {

    private final String sessionId;
    private final String verificationUrl;
    private final String vendorData;
    private final Integer sessionNumber;
    private final String rawResponseJson;

    public DiditCreateSessionResult(String sessionId,
                                    String verificationUrl,
                                    String vendorData,
                                    Integer sessionNumber,
                                    String rawResponseJson) {
        this.sessionId = sessionId;
        this.verificationUrl = verificationUrl;
        this.vendorData = vendorData;
        this.sessionNumber = sessionNumber;
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

    public Integer getSessionNumber() {
        return sessionNumber;
    }

    public String getRawResponseJson() {
        return rawResponseJson;
    }
}
