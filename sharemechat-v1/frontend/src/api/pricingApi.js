// ADR-052 Frente 3 sub-frente 3.C: cliente REST del panel de reparto
// del modelo. Endpoints backend definidos en ModelPricingController
// (sub-frente 3.B, PricingService).
//
// Todos los helpers usan apiFetch para heredar auth via cookie access_token,
// refresh transparente y deteccion de mantenimiento.

import { apiFetch } from '../config/http';

/**
 * Dashboard economico agregado de la modelo. Devuelve tramo actual
 * (T0/T1/T2/T3), siguiente umbral, %reparto, rango de precio permitido,
 * tarifa elegida, Estatus Pro (elegible / activo).
 *
 * @returns {Promise<{
 *   tierCode: string,
 *   tierMinBilledGrossEur30d: number,
 *   nextTierCode: string|null,
 *   nextTierMinBilledGrossEur30d: number|null,
 *   billedGrossEur30d: number,
 *   modelSharePct: number,
 *   rateMinEurPerMin: number,
 *   rateMaxEurPerMin: number,
 *   chosenRateEurPerMin: number,
 *   proStatusEligible: boolean,
 *   proAcceptsTrial: boolean,
 *   proStatusMinBilledGrossEur30d: number,
 *   snapshotDate: string,
 * }>}
 */
export async function getEconomics() {
  return apiFetch('/models/me/economics');
}

/**
 * Actualiza la tarifa por minuto elegida por la modelo. El backend
 * valida que este dentro del rango [rateMin, rateMax] del tramo vigente.
 *
 * Errores backend:
 *  - 400 BAD_REQUEST  tarifa null / negativa / cero / fuera de rango.
 *
 * @param {number} rateEurPerMin  tarifa nueva (ej. 2.50)
 * @returns {Promise<ModelEconomicsDTO>}  dashboard actualizado
 */
export async function updatePricing(rateEurPerMin) {
  return apiFetch('/models/me/pricing', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rateEurPerMin }),
  });
}

/**
 * Activa/desactiva la aceptacion de clientes trial por parte de la
 * modelo con Estatus Pro. Se persiste aunque Pro no sea elegible
 * (preserva preferencia para cuando la modelo cruce el umbral).
 *
 * Errores backend:
 *  - 400 BAD_REQUEST  accepts null.
 *
 * @param {boolean} acceptsTrial  true para aceptar trials, false para rechazar
 * @returns {Promise<ModelEconomicsDTO>}  dashboard actualizado
 */
export async function updateProStatus(acceptsTrial) {
  return apiFetch('/models/me/pro-status', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acceptsTrial }),
  });
}

export const pricingApi = {
  getEconomics,
  updatePricing,
  updateProStatus,
};

export default pricingApi;
