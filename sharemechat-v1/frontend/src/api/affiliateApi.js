// Cliente REST del programa de afiliadas de la modelo (ADR-049).
// Consume los endpoints backend cerrados en Subpasada 2A (activate/panel/qr).
//
// Todos los helpers usan `apiFetch` para heredar auth (cookie access_token),
// refresh transparente y deteccion de mantenimiento. El QR SVG NO usa
// apiFetch porque necesitamos el body como Blob para
// URL.createObjectURL; usa fetch nativo con `credentials: 'include'`
// (misma cookie same-site del resto del proyecto).

import { apiFetch } from '../config/http';
import { buildApiUrl } from '../config/api';

/**
 * Recupera el estado actual del panel de afiliadas de la modelo autenticada.
 *
 * @returns {Promise<{
 *   code: string|null,
 *   active: boolean,
 *   urlCanonical: string|null,
 *   stats: {
 *     clicksTotal: number,
 *     clicksUniqueVisitors: number,
 *     clientsReferred: number,
 *     commissionAccruedCents: number,
 *   }
 * }>}
 */
export async function getAffiliateDashboard() {
  return apiFetch('/models/me/affiliate');
}

/**
 * Activa el programa de afiliadas para la modelo autenticada, generando
 * su codigo si no lo tenia. Idempotente: si ya tenia codigo, devuelve el
 * existente con {@code alreadyActivated: true}.
 *
 * Errores conocidos del backend (ADR-049 Subpasada 2A):
 *  - 403 role_required
 *  - 403 kyc_required (payload incluye current_status)
 *  - 403 account_suspended
 *  - 503 code_generation_exhausted
 *
 * @returns {Promise<{code: string, activatedAt: string, alreadyActivated: boolean}>}
 */
export async function activateAffiliate() {
  return apiFetch('/models/me/affiliate/activate', {
    method: 'POST',
  });
}

/**
 * Descarga el QR SVG del panel de afiliadas como Blob para renderizarlo
 * inline via {@code URL.createObjectURL}. Usa fetch nativo con
 * {@code credentials: 'include'} para que la cookie
 * {@code access_token} viaje same-site.
 *
 * El caller es responsable de llamar {@code URL.revokeObjectURL(url)}
 * cuando el object URL ya no se necesita para evitar memory leaks.
 *
 * @returns {Promise<Blob>} el SVG como Blob (image/svg+xml).
 */
export async function fetchAffiliateQrBlob() {
  const res = await fetch(buildApiUrl('/models/me/affiliate/qr.svg'), {
    credentials: 'include',
    headers: { 'Accept': 'image/svg+xml' },
  });
  if (!res.ok) {
    throw new Error(`QR fetch failed: HTTP ${res.status}`);
  }
  return res.blob();
}

export const affiliateApi = {
  getAffiliateDashboard,
  activateAffiliate,
  fetchAffiliateQrBlob,
};

export default affiliateApi;
