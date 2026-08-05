package com.sharemechat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Body de POST /api/users/me/password/initial. Permite a un user Google-only
 * (creado sin password via /api/auth/google) establecer su primera password
 * como fallback. Solo aceptado si {@code users.password IS NULL}.
 */
public class SetInitialPasswordRequest {

    @NotBlank
    @Size(min = 8, max = 100)
    private String newPassword;

    public String getNewPassword() { return newPassword; }
    public void setNewPassword(String newPassword) { this.newPassword = newPassword; }
}
