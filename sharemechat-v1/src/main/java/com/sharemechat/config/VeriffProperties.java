package com.sharemechat.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "kyc.veriff")
public class VeriffProperties {

    private boolean enabled = false;
    private String baseUrl = "https://stationapi.veriff.com";
    private String apiKey;
    private String apiSecret;
    private String callbackUrl;
    private String personUrl;
    private String vendorDataPrefix = "smc";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public String getApiSecret() {
        return apiSecret;
    }

    public void setApiSecret(String apiSecret) {
        this.apiSecret = apiSecret;
    }

    public String getCallbackUrl() {
        return callbackUrl;
    }

    public void setCallbackUrl(String callbackUrl) {
        this.callbackUrl = callbackUrl;
    }

    public String getPersonUrl() {
        return personUrl;
    }

    public void setPersonUrl(String personUrl) {
        this.personUrl = personUrl;
    }

    public String getVendorDataPrefix() {
        return vendorDataPrefix;
    }

    public void setVendorDataPrefix(String vendorDataPrefix) {
        this.vendorDataPrefix = vendorDataPrefix;
    }
}