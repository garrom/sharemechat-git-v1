package com.sharemechat.dto;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class UserRegisterDTO {

    @NotBlank(message = "El email no puede estar vacío")
    @Email(message = "El email debe ser válido")
    private String email;

    @NotBlank(message = "La contraseña no puede estar vacía")
    @Size(min = 8, message = "La contraseña debe tener al menos 8 caracteres")
    private String password;

    @NotBlank(message = "El nickname es obligatorio")
    private String nickname;

    // Consentimientos / auditoría
    @NotNull(message = "Debes confirmar que eres mayor de edad")
    private Boolean confirAdult;

    @NotNull(message = "Debes aceptar los términos y condiciones")
    private Boolean acceptedTerm;

    // Versión de términos e IP de registro (opcional que vengan del frontal)
    private String termVersion;
    private String registerIp;

    // getter y setter


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
