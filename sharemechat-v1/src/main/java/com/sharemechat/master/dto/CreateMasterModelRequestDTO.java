package com.sharemechat.master.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * ADR-056 D7: input del formulario del Master para invitar a una modelo
 * a operar bajo su umbrella. Email + nickname + % pactado inicial. La
 * modelo genera su propia password via link de activacion (Master NO
 * gestiona credenciales, elimina riesgo GDPR consentimiento viciado).
 *
 * <p>El % pactado inicial ({@code initialInternalSharePct}) es
 * obligatorio desde 2026-07-31: sin pacto registrado la modelo puede
 * empezar a emitir "a ciegas" sin evidencia del acuerdo Master↔Modelo,
 * quedando expuesta a que el Master arbitrariamente le pague menos de
 * lo esperado (el motor economico no aplica el reparto automatico —
 * Master recibe todo y paga off-platform). Enforce upstream para
 * cerrar el vacio desde el origen; complementado por gate hard en
 * matching como safety net.
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

    @NotNull(message = "El % pactado inicial es obligatorio")
    @Min(value = 0, message = "El % pactado debe estar entre 0 y 100")
    @Max(value = 100, message = "El % pactado debe estar entre 0 y 100")
    private BigDecimal initialInternalSharePct;

    public String getModelEmail() { return modelEmail; }
    public void setModelEmail(String modelEmail) { this.modelEmail = modelEmail; }

    public String getModelNickname() { return modelNickname; }
    public void setModelNickname(String modelNickname) { this.modelNickname = modelNickname; }

    public BigDecimal getInitialInternalSharePct() { return initialInternalSharePct; }
    public void setInitialInternalSharePct(BigDecimal initialInternalSharePct) {
        this.initialInternalSharePct = initialInternalSharePct;
    }
}
