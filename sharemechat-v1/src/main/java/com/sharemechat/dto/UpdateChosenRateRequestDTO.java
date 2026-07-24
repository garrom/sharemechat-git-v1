package com.sharemechat.dto;

import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * Body de {@code PUT /api/models/me/pricing} (ADR-052 §D2). La modelo
 * elige su tarifa por minuto dentro del rango vigente de su tramo.
 * El service valida el rango antes de persistir.
 */
public class UpdateChosenRateRequestDTO {

    @NotNull
    private BigDecimal rateEurPerMin;

    public UpdateChosenRateRequestDTO() {}

    public BigDecimal getRateEurPerMin() { return rateEurPerMin; }
    public void setRateEurPerMin(BigDecimal rateEurPerMin) { this.rateEurPerMin = rateEurPerMin; }
}
