package com.sharemechat.dto;

public class ModelChecklistUpdateDTO {
    private Boolean frontOk;
    private Boolean backOk;
    private Boolean selfieOk;

    public Boolean getFrontOk() { return frontOk; }
    public void setFrontOk(Boolean frontOk) { this.frontOk = frontOk; }

    public Boolean getBackOk() { return backOk; }
    public void setBackOk(Boolean backOk) { this.backOk = backOk; }

    public Boolean getSelfieOk() { return selfieOk; }
    public void setSelfieOk(Boolean selfieOk) { this.selfieOk = selfieOk; }
}
