package com.sharemechat.dto;

import jakarta.validation.constraints.NotNull;

public class VerificationStatusUpdateDTO {

    @NotNull
    private String verificationStatus;

    public String getVerificationStatus() {
        return verificationStatus;
    }

    public void setVerificationStatus(String verificationStatus) {
        this.verificationStatus = verificationStatus;
    }
}