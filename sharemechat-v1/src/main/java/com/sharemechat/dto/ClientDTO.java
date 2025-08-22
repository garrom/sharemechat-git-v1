package com.sharemechat.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public class ClientDTO {

    private Long userId;
    private Boolean isActive;
    private BigDecimal streamingHours;
    private BigDecimal saldoActual;
    private BigDecimal totalPagos;

    // Getters y Setters

    public Long getUserId() {return userId;}

    public void setUserId(Long userId) {this.userId = userId;}

    public Boolean getActive() {return isActive;}

    public void setActive(Boolean active) {isActive = active;}

    public BigDecimal getStreamingHours() {return streamingHours;}

    public void setStreamingHours(BigDecimal streamingHours) {this.streamingHours = streamingHours;}

    public BigDecimal getSaldoActual() {return saldoActual;}

    public void setSaldoActual(BigDecimal saldoActual) {this.saldoActual = saldoActual;}

    public BigDecimal getTotalPagos() {return totalPagos;}

    public void setTotalPagos(BigDecimal totalPagos) {this.totalPagos = totalPagos;}
}
