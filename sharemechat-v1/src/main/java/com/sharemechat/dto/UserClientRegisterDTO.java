package com.sharemechat.dto;
import jakarta.validation.constraints.*;

public class UserClientRegisterDTO {

    @NotBlank(message = "El email no puede estar vacío")
    @Email(message = "El email debe ser válido")
    private String email;

    @NotBlank(message = "La contraseña no puede estar vacía")
    @Size(min = 10, message = "La contraseña debe tener al menos 10 caracteres")
    @Pattern(regexp = "^\\S+$", message = "La contraseña no puede contener espacios")
    private String password;

    // H2 (hardening Lote 1) + fix friccion registro (2026-08-10): en vez de
    // RECHAZAR nicknames con espacios o caracteres peligrosos (payloads
    // HTML/JS, control chars) como hacia el antiguo @Pattern, el servicio los
    // SANEA con NicknameNormalizer (espacios -> guion; elimina todo lo que no
    // sea [\p{L}\p{N}._-]; recorta a 30). Misma garantia anti-inyeccion (nada
    // de < > & " ' ni control chars llega a persistirse ni a los emails), pero
    // sin bloquear a la persona. Aqui solo acotamos longitud bruta y
    // obligatoriedad; el frontend ademas envia el nickname ya normalizado.
    @NotBlank(message = "El nickname es obligatorio")
    @Size(max = 60, message = "El nickname es demasiado largo")
    private String nickname;

    @NotNull(message = "Debes confirmar que eres mayor de edad")
    private Boolean confirAdult;

    @NotNull(message = "Debes aceptar los términos y condiciones")
    private Boolean acceptedTerm;

    @NotBlank(message = "El idioma de interfaz es obligatorio")
    private String uiLocale;

    // Versión de términos e IP de registro (opcional que vengan del frontal)
    private String termVersion;
    private String registerIp;

    // Capa B atribucion de origen (ADR-057): first-touch opcional que envia el
    // frontend desde la cookie smc_attribution. Sin PII directa.
    private AcquisitionDTO acquisition;

    // getter y setter


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

    public AcquisitionDTO getAcquisition() {
        return acquisition;
    }

    public void setAcquisition(AcquisitionDTO acquisition) {
        this.acquisition = acquisition;
    }
}
