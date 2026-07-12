// Cliente REST de los endpoints publicos del programa de afiliadas
// (ADR-049 Subpasada 2B). Los consume la landing publica
// AffiliateLandingPage.jsx montada en /i y /register/client.
//
// Todos los helpers usan `apiFetch` para heredar auth cookie same-site
// (no necesaria aqui — endpoints publicos — pero mantiene la deteccion
// de mantenimiento y el refresh transparente que aporta el interceptor
// comun del proyecto).

import { apiFetch } from '../config/http';

/**
 * Registra una visita a la landing publica de una modelo afiliada.
 * El backend setea la cookie {@code sharemechat_affiliate_ref} con
 * TTL 90 dias (property {@code affiliate.cookie.ttl-days}) y persiste
 * un evento {@code CLICK} en {@code affiliate_click_events} si el code
 * resuelve a una modelo APPROVED activa. Si el code es invalido o la
 * modelo no esta activa, el backend devuelve 204 silenciosamente sin
 * setear cookie ni persistir evento (decision D15 del ADR-049).
 *
 * @param {string} code - codigo de referral Crockford Base32 (12 chars).
 * @returns {Promise<Response>} 204 en happy y en silent-skip.
 */
export async function recordClick(code) {
  return apiFetch('/public/affiliate/click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
}

/**
 * Solicita el envio de un magic link tipo Uber/Airbnb para preservar
 * la atribucion cross-device. El backend genera un token opaco, guarda
 * su hash SHA-256 en {@code affiliate_link_tokens} con TTL 72 h,
 * dispara email al visitante con la URL de consumo, y persiste evento
 * {@code EMAIL_SUBMITTED}. Rate limit 5 requests/IP/hora aplicado en
 * el backend via {@code ApiRateLimitService}.
 *
 * @param {string} code - codigo de referral Crockford Base32 (12 chars).
 * @param {string} email - email del visitante (validado formato en backend).
 * @returns {Promise<Response>} 204 happy path.
 * @throws error con {@code status} 429 si se excede el rate limit,
 *         400 si el email es invalido, 500 si el envio de email fallo.
 */
export async function sendMagicLink(code, email) {
  return apiFetch('/public/affiliate/magic-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, email }),
  });
}

export const affiliatePublicApi = { recordClick, sendMagicLink };
export default affiliatePublicApi;
