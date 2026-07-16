// ADR-051 Fase 4a: cliente REST del subsistema PSP (billing).
// Endpoints backend definidos en PspController + PspWebhookController
// (Fase 3, commit 03e394a).
//
// Todos los helpers usan apiFetch (misma convencion que affiliateApi.js)
// para heredar auth via cookie access_token, refresh transparente y
// deteccion de mantenimiento.

import { apiFetch } from '../config/http';

/**
 * Crea un checkout hosted en NOWPayments para el pack indicado y
 * devuelve la URL a la que hay que redirigir al usuario (invoice hosted
 * page del vendor). El backend persiste PaymentSession en PENDING antes
 * de responder; el credit al saldo ocurre de forma asincrona cuando
 * llega el webhook IPN del vendor.
 *
 * Errores backend conocidos (ADR-051 Fase 3):
 *  - 400 BAD_REQUEST         packId invalido, user no encontrado.
 *  - 503 PSP_UNAVAILABLE     kill-switch runtime OFF o vendor caido.
 *  - 500 INTERNAL_ERROR      error inesperado en el orquestador.
 *
 * @param {string} packId  "P10" | "P20" | "P40"
 * @returns {Promise<{orderId: string, invoiceUrl: string, sessionId: number}>}
 */
export async function createNowPaymentsCheckout(packId) {
  return apiFetch('/billing/nowpayments/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ packId }),
  });
}

/**
 * Devuelve el estado actual de una PaymentSession por su orderId.
 * Guardado por ownership: solo el usuario dueno de la sesion puede
 * leerla. Se usa desde CheckoutSuccessPage para polling hasta ver
 * status=SUCCESS (webhook procesado) o timeout.
 *
 * @param {string} orderId  UUID del pedido devuelto por createNowPaymentsCheckout
 * @returns {Promise<{
 *   orderId: string,
 *   status: 'PENDING'|'SUCCESS'|'FAILED'|'EXPIRED'|'REFUNDED',
 *   packId: string,
 *   amount: number,
 *   currency: string,
 *   provider: string,
 * }>}
 */
export async function getSessionStatus(orderId) {
  return apiFetch(`/billing/session/${encodeURIComponent(orderId)}/status`);
}

export const billingApi = {
  createNowPaymentsCheckout,
  getSessionStatus,
};

export default billingApi;
