package com.sharemechat.dto;

import jakarta.validation.constraints.*;

import java.time.LocalDate;

public class UserModelRegisterDTO {

    @NotBlank(message = "El email no puede estar vacío")
    @Email(message = "El email debe ser válido")
    private String email;

    @NotBlank(message = "La contraseña no puede estar vacía")
    @Size(min = 10, message = "La contraseña debe tener al menos 10 caracteres")
    @Pattern(regexp = "^\\S+$", message = "La contraseña no puede contener espacios")
    private String password;

    @NotNull(message = "La fecha de nacimiento no puede estar vacía")
    @Past(message = "La fecha de nacimiento debe ser una fecha pasada")
    private LocalDate dateOfBirth;

    @NotBlank(message = "El nickname es obligatorio")
    private String nickname;

    @NotNull(message = "Debes confirmar que eres mayor de edad")
    private Boolean confirAdult;

    @NotNull(message = "Debes aceptar los términos y condiciones")
    private Boolean acceptedTerm;

    @NotBlank(message = "El idioma de interfaz es obligatorio")
    private String uiLocale;

    private String termVersion;
    private String registerIp;

    // Getters y Setters


    public String getUiLocale() {return uiLocale;}
    public void setUiLocale(String uiLocale) {this.uiLocale = uiLocale;}

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

    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    public void setDateOfBirth(LocalDate dateOfBirth) {
        this.dateOfBirth = dateOfBirth;
    }

    public String getNickname() {
        return nickname;
    }

    public void setNickname(String nickname) {
        this.nickname = nickname;
    }

    public Boolean getConfirAdult() {
        return confirAdult;
    }

    public void setConfirAdult(Boolean confirAdult) {
        this.confirAdult = confirAdult;
    }

    public Boolean getAcceptedTerm() {
        return acceptedTerm;
    }

    public void setAcceptedTerm(Boolean acceptedTerm) {
        this.acceptedTerm = acceptedTerm;
    }

    public String getTermVersion() {
        return termVersion;
    }

    public void setTermVersion(String termVersion) {
        this.termVersion = termVersion;
    }

    public String getRegisterIp() {
        return registerIp;
    }

    public void setRegisterIp(String registerIp) {
        this.registerIp = registerIp;
    }
}