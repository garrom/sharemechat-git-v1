package com.sharemechat.master.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * ADR-056 D7: input del formulario del Master para invitar a una modelo
 * a operar bajo su umbrella. Solo email + nickname. La modelo genera
 * su propia password via link de activacion (Master NO gestiona
 * credenciales, elimina riesgo GDPR consentimiento viciado).
 */
public class CreateMasterModelRequestDTO {

    @NotBlank(message = "El email personal de la modelo es obligatorio")
    @Email(message = "El email debe ser valido")
    private String modelEmail;

    @NotBlank(message = "El nickname sugerido es obligatorio")
    @Size(min = 3, max = 30)
    @Pattern(regexp = "^[\\p{L}\\p{N}._-]{3,30}$",
            message = "El nickname solo puede contener letras, digitos y . _ -")
    private String modelNickname;

    public String getModelEmail() { return modelEmail; }
    public void setModelEmail(String modelEmail) { this.modelEmail = modelEmail; }

    public String getModelNickname() { return modelNickname; }
    public void setModelNickname(String modelNickname) { this.modelNickname = modelNickname; }
}
