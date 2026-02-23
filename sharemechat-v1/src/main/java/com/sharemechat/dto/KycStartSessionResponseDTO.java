package com.sharemechat.dto;

public class KycStartSessionResponseDTO {

    private Long userId;
    private String provider;
    private String providerSessionId;
    private String verificationUrl;
    private String providerStatus;
    private String mappedStatus;

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getProviderSessionId() {
        return providerSessionId;
    }

    public void setProviderSessionId(String providerSessionId) {
        this.providerSessionId = providerSessionId;
    }

    public String getVerificationUrl() {
        return verificationUrl;
    }

    public void setVerificationUrl(String verificationUrl) {
        this.verificationUrl = verificationUrl;
    }

    public String getProviderStatus() {
        return providerStatus;
    }

    public void setProviderStatus(String providerStatus) {
        this.providerStatus = providerStatus;
    }

    public String getMappedStatus() {
        return mappedStatus;
    }

    public void setMappedStatus(String mappedStatus) {
        this.mappedStatus = mappedStatus;
    }
}