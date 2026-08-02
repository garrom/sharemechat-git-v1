// Cliente REST del rol Master (ADR-056, Fases S2/S4/S5.a).
// Consume /api/masters/** con auth cookie heredada de apiFetch.

import { apiFetch } from '../config/http';

// ============================================================
// Perfil + Overview (S5.a.2)
// ============================================================

/** GET /api/masters/me — perfil + saldo del Master autenticado. */
export async function getMe() {
  return apiFetch('/masters/me');
}

/** GET /api/masters/me/overview — KPIs consolidados para dashboard Overview. */
export async function getOverview() {
  return apiFetch('/masters/me/overview');
}

// ============================================================
// Historial (S5.a.3)
// ============================================================

/**
 * GET /api/masters/me/transactions — ledger paginado del Master.
 *
 * @param {{ types?: string[], from?: string, to?: string, page?: number, size?: number }} opts
 * @returns {Promise<{ items: Array, page: number, size: number, totalPages: number, totalElements: number }>}
 */
export async function listTransactions(opts = {}) {
  const params = new URLSearchParams();
  if (Array.isArray(opts.types) && opts.types.length > 0) {
    params.set('types', opts.types.join(','));
  }
  if (opts.from) params.set('from', opts.from);
  if (opts.to) params.set('to', opts.to);
  if (opts.page != null) params.set('page', String(opts.page));
  if (opts.size != null) params.set('size', String(opts.size));
  const qs = params.toString();
  return apiFetch(`/masters/me/transactions${qs ? `?${qs}` : ''}`);
}

// ============================================================
// Recent active models (iter.6, 2026-08-02)
// ============================================================

/**
 * GET /api/masters/me/recent-active-models — top modelos por facturación
 * bruta atribuida al Master en la ventana solicitada.
 *
 * @param {{ limit?: number, window?: 'today'|'7d'|'30d' }} opts
 * @returns {Promise<{ window: string, from: string, to: string, items: Array<{ modelUserId: number, modelNickname: string|null, totalGross: number, lastActivityAt: string|null }> }>}
 */
export async function getRecentActiveModels(opts = {}) {
  const params = new URLSearchParams();
  if (opts.limit != null) params.set('limit', String(opts.limit));
  if (opts.window) params.set('window', opts.window);
  const qs = params.toString();
  return apiFetch(`/masters/me/recent-active-models${qs ? `?${qs}` : ''}`);
}

// ============================================================
// Payout methods (S6.a, 2026-08-02)
// ============================================================

/** GET /api/masters/me/payout-methods — lista métodos del Master. */
export async function listPayoutMethods() {
  return apiFetch('/masters/me/payout-methods');
}

/**
 * POST /api/masters/me/payout-methods
 * @param {{ rail: string, accountRef: string, displayAlias?: string, setAsDefault?: boolean }} body
 */
export async function createPayoutMethod(body) {
  return apiFetch('/masters/me/payout-methods', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** PATCH /api/masters/me/payout-methods/{id} — actualiza rail/accountRef/alias. */
export async function updatePayoutMethod(id, body) {
  if (!id) throw new Error('id requerido');
  return apiFetch(`/masters/me/payout-methods/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** PATCH /api/masters/me/payout-methods/{id}/default — marca como default. */
export async function setDefaultPayoutMethod(id) {
  if (!id) throw new Error('id requerido');
  return apiFetch(`/masters/me/payout-methods/${encodeURIComponent(id)}/default`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  });
}

/** DELETE /api/masters/me/payout-methods/{id}. */
export async function deletePayoutMethod(id) {
  if (!id) throw new Error('id requerido');
  return apiFetch(`/masters/me/payout-methods/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ============================================================
// Payout (S5.a.4)
// ============================================================

/**
 * POST /api/masters/me/payout — solicita retiro.
 *
 * @param {{ amount: number, description?: string, channel?: 'PAXUM'|'YOURSAFE'|'NOWPAYMENTS_CRYPTO'|'SEPA_MANUAL' }} body
 */
export async function requestPayout(body) {
  if (!body || body.amount == null) throw new Error('amount requerido');
  return apiFetch('/masters/me/payout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ============================================================
// Modelos bajo umbrella (S4 ya existente)
// ============================================================

/** GET /api/masters/me/models — listado modelos sin PII. */
export async function listModels() {
  return apiFetch('/masters/me/models');
}

/** GET /api/masters/me/models/{id} — detalle modelo (guard ownership). */
export async function getModel(id) {
  if (!id) throw new Error('id requerido');
  return apiFetch(`/masters/me/models/${encodeURIComponent(id)}`);
}

/** POST /api/masters/me/models — invita a una modelo bajo umbrella. */
export async function inviteModel(body) {
  if (!body || !body.modelEmail) throw new Error('modelEmail requerido');
  if (!body.modelNickname) throw new Error('modelNickname requerido');
  if (body.initialInternalSharePct == null) {
    throw new Error('initialInternalSharePct requerido');
  }
  return apiFetch('/masters/me/models', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** PATCH /api/masters/me/models/{id}/active — activar o desactivar. */
export async function setModelActive(id, active) {
  if (!id) throw new Error('id requerido');
  return apiFetch(`/masters/me/models/${encodeURIComponent(id)}/active`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active: !!active }),
  });
}

/** PATCH /api/masters/me/models/{id}/internal-share — registra % pactado interno. */
export async function setInternalShare(id, internalSharePct, notes) {
  if (!id) throw new Error('id requerido');
  if (internalSharePct == null) throw new Error('internalSharePct requerido');
  return apiFetch(`/masters/me/models/${encodeURIComponent(id)}/internal-share`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ internalSharePct, notes: notes || null }),
  });
}

// ============================================================
// Contrato + KYC (S2 ya existente)
// ============================================================

/** GET /api/masters/me/contract — devuelve la versión vigente del contrato Master. */
export async function getCurrentContract() {
  return apiFetch('/masters/me/contract');
}

/** POST /api/masters/me/contract/accept — firma contrato Master (idempotente). */
export async function acceptContract() {
  return apiFetch('/masters/me/contract/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

/** POST /api/masters/me/kyc/didit — arranca sesión KYC persona física. */
export async function startDiditKyc() {
  return apiFetch('/masters/me/kyc/didit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

export const masterApi = {
  getMe,
  getOverview,
  listTransactions,
  getRecentActiveModels,
  listPayoutMethods,
  createPayoutMethod,
  updatePayoutMethod,
  setDefaultPayoutMethod,
  deletePayoutMethod,
  requestPayout,
  listModels,
  getModel,
  inviteModel,
  setModelActive,
  setInternalShare,
  getCurrentContract,
  acceptContract,
  startDiditKyc,
};

export default masterApi;
