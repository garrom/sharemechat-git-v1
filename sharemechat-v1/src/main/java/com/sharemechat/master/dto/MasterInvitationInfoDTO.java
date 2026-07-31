package com.sharemechat.master.dto;

/**
 * ADR-056: metadata publica de una invitacion de modelo, expuesta por
 * {@code GET /api/masters/models/invitation-info/{token}} sin consumir el
 * token. Sirve para que la pagina de activacion muestre el nombre del
 * estudio (Master) que invita antes de que la modelo elija password.
 */
public class MasterInvitationInfoDTO {

    private String masterDisplayName;
    private String modelNickname;

    public MasterInvitationInfoDTO() {}

    public MasterInvitationInfoDTO(String masterDisplayName, String modelNickname) {
        this.masterDisplayName = masterDisplayName;
        this.modelNickname = modelNickname;
    }

    public String getMasterDisplayName() { return masterDisplayName; }
    public void setMasterDisplayName(String masterDisplayName) { this.masterDisplayName = masterDisplayName; }

    public String getModelNickname() { return modelNickname; }
    public void setModelNickname(String modelNickname) { this.modelNickname = modelNickname; }
}
