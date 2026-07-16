package com.sharemechat.psp.dto;

/**
 * ADR-051 D1: estados normalizados del ciclo de vida de un pago,
 * vendor-agnostic. Cada {@link com.sharemechat.psp.service.PaymentProvider}
 * mapea los estados nativos del vendor a estos.
 *
 * <p>Ejemplo NOWPayments → nuestro enum:
 * <ul>
 *   <li>{@code waiting} → {@link #PENDING}</li>
 *   <li>{@code confirming} → {@link #PENDING}</li>
 *   <li>{@code confirmed} → {@link #PENDING} (aún no released, esperando conversión)</li>
 *   <li>{@code sending} → {@link #PENDING}</li>
 *   <li>{@code partially_paid} → {@link #FAILED} (no acreditamos parcial)</li>
 *   <li>{@code finished} → {@link #SUCCESS} (payment_sessions.status=SUCCESS + creditPackWithBonus)</li>
 *   <li>{@code failed} → {@link #FAILED}</li>
 *   <li>{@code refunded} → {@link #REFUNDED} (BFPM 4B-b + reversal en frente propio)</li>
 *   <li>{@code expired} → {@link #EXPIRED}</li>
 * </ul>
 */
public enum PaymentStatus {

    /** Iniciado pero aún no confirmado por el vendor. */
    PENDING,

    /** Confirmado y acreditado. Estado terminal happy path. */
    SUCCESS,

    /** Rechazado, cancelado o parcialmente pagado. Estado terminal. */
    FAILED,

    /** Sesión no completada dentro de la ventana del vendor. Estado terminal. */
    EXPIRED,

    /**
     * Reembolsado tras haber sido SUCCESS. Requiere reversal BFPM
     * (deuda #D-35 del ADR-051 - política de refund con bonus).
     */
    REFUNDED
}
