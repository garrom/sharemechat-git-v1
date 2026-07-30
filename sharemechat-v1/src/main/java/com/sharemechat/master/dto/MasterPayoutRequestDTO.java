package com.sharemechat.master.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * ADR-056 S5.a.4: input del endpoint {@code POST /api/masters/me/payout}.
 * <p>
 * El {@code channel} es orientativo (Paxum/Yoursafe/cripto/manual) —
 * hasta que S6 integre adapters multi-rail reales, el channel se guarda
 * como referencia comercial en {@code description} pero el flujo real
 * se resuelve manualmente por admin.
 */
public class MasterPayoutRequestDTO {

    @NotNull(message = "El importe es obligatorio")
    @DecimalMin(value = "0.01", message = "El importe debe ser mayor a cero")
    private BigDecimal amount;

    @Size(max = 500)
    private String description;

    @Size(max = 40)
    private String channel;

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getChannel() { return channel; }
    public void setChannel(String channel) { this.channel = channel; }
}
