package com.sharemechat.master.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * ADR-056 D7: input del formulario de activacion cuando la modelo abre
 * el link de email de invitacion enviado por el Master. La modelo genera
 * su propia password aqui (bajo su control exclusivo, Master no la ve).
 */
public class ActivateMasterModelRequestDTO {

    @NotBlank(message = "La contrasenya no puede estar vacia")
    @Size(min = 10, message = "La contrasenya debe tener al menos 10 caracteres")
    @Pattern(regexp = "^\\S+$", message = "La contrasenya no puede contener espacios")
    private String password;

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
}
