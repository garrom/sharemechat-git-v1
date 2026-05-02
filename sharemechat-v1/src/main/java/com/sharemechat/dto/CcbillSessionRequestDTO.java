package com.sharemechat.dto;

import jakarta.validation.constraints.NotBlank;

public class CcbillSessionRequestDTO {

    @NotBlank
    private String packId; // catálogo vigente (ADR-011 / Fase 3A): "P10", "P20", "P40"

    public String getPackId() {
        return packId;
    }

    public void setPackId(String packId) {
        this.packId = packId;
    }
}
