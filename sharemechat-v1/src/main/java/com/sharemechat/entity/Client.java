package com.sharemechat.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "clients")
public class Client {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "streaming_hours")
    private BigDecimal streamingHours  = BigDecimal.ZERO;

    @Column(name = "saldo_actual")
    private BigDecimal saldoActual  = BigDecimal.ZERO;

    @Column(name = "total_pagos")
    private BigDecimal totalPagos  = BigDecimal.ZERO;

    @OneToOne
    @MapsId
    @JoinColumn(name = "user_id")
    private User user;

    // Constructor vacío requerido por JPA
    public Client() {
    }

    // Getters y Setters


    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public BigDecimal getStreamingHours() {
        return streamingHours;
    }

    public void setStreamingHours(BigDecimal streamingHours) {
        this.streamingHours = streamingHours;
    }

    public BigDecimal getSaldoActual() {
        return saldoActual;
    }

    public void setSaldoActual(BigDecimal saldoActual) {
        this.saldoActual = saldoActual;
    }

    public BigDecimal getTotalPagos() {
        return totalPagos;
    }

    public void setTotalPagos(BigDecimal totalPagos) {
        this.totalPagos = totalPagos;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }
}
