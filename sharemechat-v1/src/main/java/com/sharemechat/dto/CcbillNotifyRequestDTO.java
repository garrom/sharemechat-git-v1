package com.sharemechat.dto;

import jakarta.validation.constraints.NotBlank;

public class CcbillNotifyRequestDTO {

    @NotBlank
    private String orderId;          // el que generamos y mandamos a CCBill

    @NotBlank
    private String pspTransactionId; // id propio de CCBill (cuando tengas doc real, ajustamos nombre)

    @NotBlank
    private String status;           // por ejemplo: "APPROVED" | "DECLINED"

    public String getOrderId() {
        return orderId;
    }

    public void setOrderId(String orderId) {
        this.orderId = orderId;
    }

    public String getPspTransactionId() {
        return pspTransactionId;
    }

    public void setPspTransactionId(String pspTransactionId) {
        this.pspTransactionId = pspTransactionId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
