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

    /**
     * @deprecated 2026-08-01: la property {@code gift.model-share} fue
     * eliminada al unificar el reparto de gifts al motor de tramos
     * (ADR-056 revision 2026-08-01, ver TransactionService
     * .processGiftInternal). Ahora los gifts aplican {@link #modelSharePct}
     * (mismo % del tramo que streams). El campo se mantiene por
     * compatibilidad con {@code SessionHUD variant='model'} y se popula
     * igual a {@code modelSharePct}. Los nuevos consumidores deben usar
     * {@link #modelSharePct} directamente. Eliminar cuando el HUD migre.
     */
    @Deprecated
    public BigDecimal giftModelSharePct;

    /**
     * ADR-056 Opcion D (2026-08-01): true si el user tiene
     * {@code Model.master_user_id} distinto de null. El frontend
     * (ModelPricingPanel / ModelBillingPanel) usa este flag como rama
     * top-level para renderizar la vista bajo-Master (transparencia +
     * neto pactado) en lugar de la vista individual. Los datos
     * economicos del DTO se sirven consistentemente al regimen que
     * aplica: si {@code underMaster=true}, {@link #modelSharePct} y
     * {@link #tierCode} vienen del regimen MASTER (T1=50/T2=60/T3=65/
     * T4=70 %); en caso contrario, INDIVIDUAL (T1=50/T2=54/T3=57/T4=60 %).
     */
    public boolean underMaster;

    /**
     * ADR-056 Opcion D (2026-08-01): % pactado interno Master↔Modelo
     * vigente desde {@code master_model_splits}. Solo poblado si
     * {@link #underMaster} es true. Sirve para que el frontend calcule
     * el neto real que cobra la modelo: {@code neto = bruto ×
     * modelSharePct/100 × internalSharePct/100}.
     */
    public BigDecimal internalSharePct;

    /**
     * ADR-056 Opcion D (2026-08-01): nombre visible del Master
     * (companyName || nickname del User Master, fallback "tu estudio").
     * Solo poblado si {@link #underMaster} es true. Sin PII.
     */
    public String masterDisplayName;
}
