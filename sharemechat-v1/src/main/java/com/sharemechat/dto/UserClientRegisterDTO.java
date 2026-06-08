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

    // H2 (hardening Lote 1): blindar nickname para que NO acepte ni
    // payloads largos ni caracteres peligrosos (HTML/JS, control chars,
    // espacios). Permitimos letras unicode (con tildes y diacriticos),
    // digitos unicode y los signos . _ - (sin espacios). Rechaza por
    // construccion < > & " ' y caracteres de control. Cierra el vector
    // "nickname = <script>...</script>" que llegaba intacto a emails
    // HTML (EmailCopyRenderer: sink HTML-escape colateral).
    @NotBlank(message = "El nickname es obligatorio")
    @Size(min = 3, max = 30, message = "El nickname debe tener entre 3 y 30 caracteres")
    @Pattern(regexp = "^[\\p{L}\\p{N}._-]{3,30}$",
            message = "El nickname solo puede contener letras, digitos y los signos . _ -")
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
}
