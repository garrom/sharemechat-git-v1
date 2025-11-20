package com.sharemechat.dto;

import jakarta.validation.constraints.NotBlank;

public class CcbillSessionRequestDTO {

    @NotBlank
    private String packId; // ej: "P5", "P15", "P30", "P45"

    public String getPackId() {
        return packId;
    }

    public void setPackId(String packId) {
        this.packId = packId;
    }
}
