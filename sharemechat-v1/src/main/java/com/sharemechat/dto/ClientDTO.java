package com.sharemechat.dto;

import java.math.BigDecimal;

public class ClientDTO {

    private Long userId;
    private BigDecimal streamingHours;
    private BigDecimal saldoActual;
    private BigDecimal totalPagos;

    // Getters y Setters

    public Long getUserId() {return userId;}

    public void setUserId(Long userId) {this.userId = userId;}

    public BigDecimal getStreamingHours() {return streamingHours;}

    public void setStreamingHours(BigDecimal streamingHours) {this.streamingHours = streamingHours;}

    public BigDecimal getSaldoActual() {return saldoActual;}

    public void setSaldoActual(BigDecimal saldoActual) {this.saldoActual = saldoActual;}

    public BigDecimal getTotalPagos() {return totalPagos;}

    public void setTotalPagos(BigDecimal totalPagos) {this.totalPagos = totalPagos;}
}
