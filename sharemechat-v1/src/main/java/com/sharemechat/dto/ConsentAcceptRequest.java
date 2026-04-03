package com.sharemechat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class ConsentAcceptRequest {

    @NotNull
    private Boolean confirmAdult;

    @NotNull
    private Boolean acceptTerms;

    @NotBlank
    private String termsVersion;

    public Boolean getConfirmAdult() {
        return confirmAdult;
    }

    public void setConfirmAdult(Boolean confirmAdult) {
        this.confirmAdult = confirmAdult;
    }

    public Boolean getAcceptTerms() {
        return acceptTerms;
    }

    public void setAcceptTerms(Boolean acceptTerms) {
        this.acceptTerms = acceptTerms;
    }

    public String getTermsVersion() {
        return termsVersion;
    }

    public void setTermsVersion(String termsVersion) {
        this.termsVersion = termsVersion;
    }
}
