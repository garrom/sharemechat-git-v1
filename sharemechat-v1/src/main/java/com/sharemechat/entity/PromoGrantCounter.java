package com.sharemechat.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * Contador atómico de bonos promo concedidos (tabla promo_grant_counter,
 * migración V52). Una fila por promo (p.ej. promo_key='WELCOME_100'). El cupo
 * (cap) NO se guarda aquí: lo aporta la config y se evalúa en el UPDATE
 * condicional {@code PromoGrantCounterRepository#tryIncrement}.
 */
@Entity
@Table(name = "promo_grant_counter")
public class PromoGrantCounter {

    @Id
    @Column(name = "promo_key", length = 64, nullable = false)
    private String promoKey;

    @Column(name = "granted", nullable = false)
    private int granted;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public String getPromoKey() {
        return promoKey;
    }

    public void setPromoKey(String promoKey) {
        this.promoKey = promoKey;
    }

    public int getGranted() {
        return granted;
    }

    public void setGranted(int granted) {
        this.granted = granted;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
