package com.sharemechat.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "model_earning_tiers")
public class ModelEarningTier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Nombre legible del tier, por ejemplo:
     *  - "3/10"
     *  - "4/11"
     *  - "5/12"
     *  - "7/24"
     */
    @Column(name = "name", nullable = false, unique = true)
    private String name;

    /**
     * Minutos facturados mínimos en la ventana para entrar en este tier.
     * Ejemplo:
     *  - 0    para el tier base
     *  - 528  para pasar de 3/10 a 4/11
     */
    @Column(name = "min_billed_minutes", nullable = false)
    private Integer minBilledMinutes;

    /**
     * Ganancia de la modelo por minuto en el PRIMER minuto
     * (para trials y también para el primer minuto de un cliente de pago).
     * Ejemplo: 0.03, 0.04, 0.05, 0.07, etc.
     */
    @Column(name = "first_minute_earning_per_min", nullable = false, precision = 10, scale = 4)
    private BigDecimal firstMinuteEarningPerMin;

    /**
     * Ganancia de la modelo por minuto a partir del segundo minuto.
     * Ejemplo: 0.10, 0.11, 0.12, 0.24, etc.
     */
    @Column(name = "next_minutes_earning_per_min", nullable = false, precision = 10, scale = 4)
    private BigDecimal nextMinutesEarningPerMin;

    /**
     * Flag para activar/desactivar tiers sin borrarlos.
     */
    @Column(name = "active", nullable = false)
    private Boolean active = true;

    public ModelEarningTier() {}

    // ===== Getters / Setters =====

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Integer getMinBilledMinutes() {
        return minBilledMinutes;
    }

    public void setMinBilledMinutes(Integer minBilledMinutes) {
        this.minBilledMinutes = minBilledMinutes;
    }

    public BigDecimal getFirstMinuteEarningPerMin() {
        return firstMinuteEarningPerMin;
    }

    public void setFirstMinuteEarningPerMin(BigDecimal firstMinuteEarningPerMin) {
        this.firstMinuteEarningPerMin = firstMinuteEarningPerMin;
    }

    public BigDecimal getNextMinutesEarningPerMin() {
        return nextMinutesEarningPerMin;
    }

    public void setNextMinutesEarningPerMin(BigDecimal nextMinutesEarningPerMin) {
        this.nextMinutesEarningPerMin = nextMinutesEarningPerMin;
    }

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }
}
