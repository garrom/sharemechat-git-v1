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

    /**
     * @deprecated S6.b (2026-08-02): sustituido por {@link #payoutMethodId}.
     * Se mantiene por compat con clientes viejos: si viene channel y no
     * payoutMethodId, el service lo guarda en description como fallback
     * legacy y el adapter Noop procesa manualmente. Retirar en S6.c.
     */
    @Deprecated
    @Size(max = 40)
    private String channel;

    /**
     * S6.b: id del PayoutMethod pre-registrado del user (S6.a). El
     * service verifica ownership. Cuando viene, el rail se lee del
     * PayoutMethod y el channel string se ignora.
     */
    private Long payoutMethodId;

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getChannel() { return channel; }
    public void setChannel(String channel) { this.channel = channel; }

    public Long getPayoutMethodId() { return payoutMethodId; }
    public void setPayoutMethodId(Long payoutMethodId) { this.payoutMethodId = payoutMethodId; }
}
