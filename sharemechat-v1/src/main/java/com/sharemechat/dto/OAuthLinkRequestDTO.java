package com.sharemechat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Body de POST /api/users/me/oauth/google/link. El user autenticado envia
 * su ID token de Google para vincular esa cuenta Google a su cuenta
 * SharemeChat. Sirve al patron P3 estricto: user con password ya
 * autenticado + segundo factor (Google) para vincular.
 */
public class OAuthLinkRequestDTO {

    @NotBlank
    @Size(max = 4096)
    private String idToken;

    public String getIdToken() { return idToken; }
    public void setIdToken(String idToken) { this.idToken = idToken; }
}
