package com.sharemechat.master.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import com.sharemechat.dto.AcquisitionDTO;

import java.time.LocalDate;

/**
 * ADR-056 D6 (2026-07-29): input del formulario de registro Master.
 * Campos obligatorios simetricos a UserModelRegisterDTO (persona fisica).
 * Campos company_* opcionales — el Master puede representar a una empresa,
 * pero la responsabilidad juridica siempre recae sobre la persona fisica
 * identificada por KYC.
 */
public class RegisterMasterRequestDTO {

    @NotBlank(message = "El email no puede estar vacio")
    @Email(message = "El email debe ser valido")
    private String email;

    @NotBlank(message = "La contrasenya no puede estar vacia")
    @Size(min = 10, message = "La contrasenya debe tener al menos 10 caracteres")
    @Pattern(regexp = "^\\S+$", message = "La contrasenya no puede contener espacios")
    private String password;

    @NotNull(message = "La fecha de nacimiento es obligatoria")
    @Past(message = "La fecha de nacimiento debe ser una fecha pasada")
    private LocalDate dateOfBirth;

    // fix friccion registro (2026-08-10): el servicio SANEA el nickname con
    // NicknameNormalizer (espacios -> guion; recorta a 30) en vez de rechazar.
    @NotBlank(message = "El nickname es obligatorio")
    @Size(max = 60, message = "El nickname es demasiado largo")
    private String nickname;

    @NotNull(message = "Debes confirmar que eres mayor de edad")
    private Boolean confirAdult;

    @NotNull(message = "Debes aceptar los terminos y condiciones")
    private Boolean acceptedTerm;

    @NotBlank(message = "El idioma de interfaz es obligatorio")
    private String uiLocale;

    private String termVersion;

    // Datos opcionales de empresa (declarativos — la empresa completa
    // se valida en admin manualmente, ver ADR-056 D6).
    @Size(max = 200)
    private String companyName;

    @Size(max = 100)
    private String companyRegistrationNumber;

    @Size(min = 2, max = 2, message = "companyCountry debe ser codigo ISO alpha-2")
    private String companyCountry;

    // Capa B atribucion de origen (ADR-057): first-touch opcional.
    private AcquisitionDTO acquisition;

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public LocalDate getDateOfBirth() { return dateOfBirth; }
    public void setDateOfBirth(LocalDate dateOfBirth) { this.dateOfBirth = dateOfBirth; }

    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }

    public Boolean getConfirAdult() { return confirAdult; }
    public void setConfirAdult(Boolean confirAdult) { this.confirAdult = confirAdult; }

    public Boolean getAcceptedTerm() { return acceptedTerm; }
    public void setAcceptedTerm(Boolean acceptedTerm) { this.acceptedTerm = acceptedTerm; }

    public String getUiLocale() { return uiLocale; }
    public void setUiLocale(String uiLocale) { this.uiLocale = uiLocale; }

    public String getTermVersion() { return termVersion; }
    public void setTermVersion(String termVersion) { this.termVersion = termVersion; }

    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }

    public String getCompanyRegistrationNumber() { return companyRegistrationNumber; }
    public void setCompanyRegistrationNumber(String companyRegistrationNumber) { this.companyRegistrationNumber = companyRegistrationNumber; }

    public String getCompanyCountry() { return companyCountry; }
    public void setCompanyCountry(String companyCountry) { this.companyCountry = companyCountry; }

    public AcquisitionDTO getAcquisition() { return acquisition; }
    public void setAcquisition(AcquisitionDTO acquisition) { this.acquisition = acquisition; }
}
