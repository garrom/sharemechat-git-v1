package com.sharemechat.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Dashboard economico de la modelo (ADR-052 §D9 - transparencia en panel
 * modelo). Se sirve desde {@code GET /api/models/me/economics} y agrupa
 * en un solo payload todo lo que el panel {@code /model/economics}
 * necesita renderizar:
 *
 * <ul>
 *   <li>Tramo vigente (T0/T1/T2/T3) con umbral inferior y siguiente
 *       para mostrar la progresion.</li>
 *   <li>Facturacion bruta acumulada rolling 30d (base del tramo).</li>
 *   <li>%reparto vigente.</li>
 *   <li>Rango de precio permitido + tarifa elegida por la modelo.</li>
 *   <li>Estatus Pro: elegible (cumple umbral) / activo (toggle ON) /
 *       no elegible.</li>
 *   <li>Fecha del snapshot que respalda estos datos.</li>
 * </ul>
 *
 * <p>El historial de descuentos (D9) queda como frente separado; este
 * DTO no lo incluye todavia.
 */
public class ModelEconomicsDTO {

    /** Codigo del tramo vigente (T0/T1/T2/T3). */
    public String tierCode;

    /** Umbral inferior del tramo vigente (EUR). */
    public BigDecimal tierMinBilledGrossEur30d;

    /** Umbral inferior del siguiente tramo (EUR). Null si ya esta en T3. */
    public BigDecimal nextTierMinBilledGrossEur30d;

    /** Codigo del siguiente tramo. Null si ya esta en T3. */
    public String nextTierCode;

    /** Facturacion bruta acumulada rolling 30d (EUR). Base del tramo. */
    public BigDecimal billedGrossEur30d;

    /** %reparto modelo vigente (75.00 / 77.00 / 78.00 / 79.00). */
    public BigDecimal modelSharePct;

    /** Precio minimo permitido en el tramo actual (EUR/min). */
    public BigDecimal rateMinEurPerMin;

    /** Precio maximo permitido en el tramo actual (EUR/min). */
    public BigDecimal rateMaxEurPerMin;

    /** Tarifa elegida por la modelo dentro del rango. Persistida en users. */
    public BigDecimal chosenRateEurPerMin;

    /**
     * Estatus Pro: true si la facturacion bruta rolling 30d cruza el
     * umbral {@code billing.pro-status.min-billed-gross-eur-30d}
     * (default 1500 EUR).
     */
    public boolean proStatusEligible;

    /**
     * Toggle de la modelo: si acepta clientes trial. Solo tiene efecto
     * operativo cuando {@link #proStatusEligible} es true. Por debajo del
     * umbral Pro el toggle se ignora (trials aceptados siempre).
     */
    public boolean proAcceptsTrial;

    /** Umbral Pro (EUR). Se sirve al frontend para tooltip / explicacion. */
    public BigDecimal proStatusMinBilledGrossEur30d;

    /** Fecha del snapshot que respalda estos datos (YYYY-MM-DD). */
    public LocalDate snapshotDate;
}
