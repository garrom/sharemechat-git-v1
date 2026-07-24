package com.sharemechat.dto;

import jakarta.validation.constraints.NotNull;

/**
 * Body de {@code PUT /api/models/me/pro-status} (ADR-052 §D3). La modelo
 * con Estatus Pro elegible activa/desactiva la aceptacion de clientes
 * trial en su tarjeta. El service valida elegibilidad (facturacion bruta
 * rolling 30d cruza el umbral Pro) antes de persistir el cambio.
 */
public class UpdateProStatusRequestDTO {

    @NotNull
    private Boolean acceptsTrial;

    public UpdateProStatusRequestDTO() {}

    public Boolean getAcceptsTrial() { return acceptsTrial; }
    public void setAcceptsTrial(Boolean acceptsTrial) { this.acceptsTrial = acceptsTrial; }
}
