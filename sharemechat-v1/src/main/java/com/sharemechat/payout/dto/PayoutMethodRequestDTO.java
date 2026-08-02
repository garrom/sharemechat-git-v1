package com.sharemechat.payout.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * ADR-056 S6.a: input para crear/actualizar un PayoutMethod desde el
 * endpoint autoservicio. La validación semántica de {@code accountRef}
 * según {@code rail} (formato email para PAXUM, wallet válida para
 * NOWPAYMENTS_CRYPTO, IBAN para SEPA_MANUAL/YOURSAFE) se hace en
 * PayoutMethodService — aquí solo validaciones sintácticas mínimas.
 */
public class PayoutMethodRequestDTO {

    @NotBlank(message = "rail es obligatorio")
    @Pattern(regexp = "PAXUM|YOURSAFE|NOWPAYMENTS_CRYPTO|SEPA_MANUAL",
            message = "rail debe ser PAXUM|YOURSAFE|NOWPAYMENTS_CRYPTO|SEPA_MANUAL")
    private String rail;

    @NotBlank(message = "accountRef es obligatorio")
    @Size(max = 255, message = "accountRef máximo 255 caracteres")
    private String accountRef;

    @Size(max = 80, message = "displayAlias máximo 80 caracteres")
    private String displayAlias;

    private boolean setAsDefault;

    public String getRail() { return rail; }
    public void setRail(String rail) { this.rail = rail; }

    public String getAccountRef() { return accountRef; }
    public void setAccountRef(String accountRef) { this.accountRef = accountRef; }

    public String getDisplayAlias() { return displayAlias; }
    public void setDisplayAlias(String displayAlias) { this.displayAlias = displayAlias; }

    public boolean isSetAsDefault() { return setAsDefault; }
    public void setSetAsDefault(boolean setAsDefault) { this.setAsDefault = setAsDefault; }
}
