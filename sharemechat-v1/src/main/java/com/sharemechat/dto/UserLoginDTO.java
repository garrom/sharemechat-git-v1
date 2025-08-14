package com.sharemechat.dto;

import jakarta.validation.constraints.NotBlank;

public class UserLoginDTO {
    @NotBlank(message = "El email no puede estar vacío")
    private String email;

    @NotBlank(message = "La contraseña no puede estar vacía")
    private String password;

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }
}