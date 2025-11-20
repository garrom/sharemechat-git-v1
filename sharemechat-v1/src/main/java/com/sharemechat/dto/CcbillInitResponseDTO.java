package com.sharemechat.dto;

import java.util.Map;

public class CcbillInitResponseDTO {

    private String paymentUrl;      // URL de la pasarela (sandbox/real)
    private String method;          // "POST"
    private Map<String, String> fields; // Campos hidden a enviar en el form

    public String getPaymentUrl() {
        return paymentUrl;
    }

    public void setPaymentUrl(String paymentUrl) {
        this.paymentUrl = paymentUrl;
    }

    public String getMethod() {
        return method;
    }

    public void setMethod(String method) {
        this.method = method;
    }

    public Map<String, String> getFields() {
        return fields;
    }

    public void setFields(Map<String, String> fields) {
        this.fields = fields;
    }
}
