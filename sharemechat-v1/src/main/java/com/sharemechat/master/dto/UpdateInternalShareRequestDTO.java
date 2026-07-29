package com.sharemechat.master.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * ADR-056 D10: registra el % que el Master pacta con una modelo bajo su
 * umbrella. Opaco al motor de reparto plataforma; solo trazabilidad para
 * dashboard reducido de la modelo y auditoria.
 */
public class UpdateInternalShareRequestDTO {

    @NotNull
    @DecimalMin(value = "0.00", message = "internalSharePct >= 0")
    @DecimalMax(value = "100.00", message = "internalSharePct <= 100")
    private BigDecimal internalSharePct;

    private String notes;

    public BigDecimal getInternalSharePct() { return internalSharePct; }
    public void setInternalSharePct(BigDecimal internalSharePct) { this.internalSharePct = internalSharePct; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
