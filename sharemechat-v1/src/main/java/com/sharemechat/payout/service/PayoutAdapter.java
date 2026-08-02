package com.sharemechat.payout.service;

import com.sharemechat.entity.PayoutRequest;
import com.sharemechat.payout.entity.PayoutMethod;

/**
 * ADR-056 Fase S6.b (2026-08-02): interface genérica para adapters de
 * rail de payout. Cada implementación concreta vive en su propio
 * paquete aislado ({@code payout.adapter.paxum}, {@code payout.adapter.
 * yoursafe}, etc.) y solo se referencia por esta interface desde el
 * dominio (regla vendor-agnostic — ver CLAUDE.md).
 *
 * <p>Contrato:
 * <ul>
 *   <li>{@link #supports(String)} — indica si el adapter maneja el rail
 *       (case-sensitive, coincide con {@code PayoutMethod.rail}).</li>
 *   <li>{@link #send(PayoutRequest, PayoutMethod)} — dispara el envío
 *       real al vendor. Idempotente por {@code payoutRequestId}. Debe
 *       lanzar {@link PayoutAdapterException} si el vendor falla.
 *       El servicio orquestador es responsable de re-intentar o
 *       reportar según el resultado.</li>
 * </ul>
 *
 * <p>En S6.b MVP solo existe {@link NoopPayoutAdapter} que loguea y
 * devuelve OK sin llamar a nadie. Cuando exista un vendor real
 * (Paxum, Yoursafe, cripto), su HttpClient se encapsula en un adapter
 * concreto que implementa esta interface, sin tocar el dominio.
 */
public interface PayoutAdapter {

    boolean supports(String rail);

    PayoutAdapterResult send(PayoutRequest payoutRequest, PayoutMethod method) throws PayoutAdapterException;

    /**
     * Resultado de {@link #send}. En S6.b solo transporta un
     * {@code providerReference} opcional (id de la transacción en el
     * vendor, útil para audit y reconciliación) y un flag {@code queued}
     * que indica si el vendor aceptó la petición para procesamiento
     * asíncrono (vs. ejecución síncrona).
     */
    class PayoutAdapterResult {
        private final String providerReference;
        private final boolean queued;

        public PayoutAdapterResult(String providerReference, boolean queued) {
            this.providerReference = providerReference;
            this.queued = queued;
        }

        public String getProviderReference() { return providerReference; }
        public boolean isQueued() { return queued; }
    }

    /**
     * Fallo del vendor (rail no disponible, timeout, credenciales
     * inválidas, cuenta destino rechazada). El servicio orquestador
     * decide si retry o marca la PayoutRequest como {@code FAILED}.
     */
    class PayoutAdapterException extends RuntimeException {
        public PayoutAdapterException(String message) { super(message); }
        public PayoutAdapterException(String message, Throwable cause) { super(message, cause); }
    }
}
