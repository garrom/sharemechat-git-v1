// Cliente REST del sistema de tickets de incidencias (ADR-054, Fase T2
// backend + T4 frontend). Consume /api/tickets/** con auth cookie
// heredada de apiFetch.

import { apiFetch } from '../config/http';

/**
 * Abre un nuevo ticket. Backend valida categoria + descripcion + rate
 * limits D7 (max 2 abiertos, max 5/30d). Devuelve el TicketResponseDTO.
 *
 * @param {{
 *   category: 'STREAM_INTERRUPTED'|'PAYMENT_NOT_CREDITED'|'MODERATION_FALSE_POSITIVE'|'ACCOUNT_ISSUE'|'OTHER',
 *   description: string,
 *   reportedIncidentAt?: string,
 *   linkedStreamRecordId?: number,
 *   linkedPaymentSessionId?: number
 * }} body
 * @returns {Promise<Object>}
 */
export async function createTicket(body) {
  if (!body || !body.category) throw new Error('category requerido');
  if (!body.description || !body.description.trim()) throw new Error('description requerido');
  return apiFetch('/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Lista los tickets propios del user autenticado, ordenados DESC por id. */
export async function listMyTickets() {
  return apiFetch('/tickets');
}

/**
 * Detalle de un ticket propio. Backend enforce ownership; devuelve 404 si el
 * ticket no pertenece al user.
 */
export async function getMyTicket(id) {
  if (!id) throw new Error('id requerido');
  return apiFetch(`/tickets/${encodeURIComponent(id)}`);
}

export const ticketsApi = { createTicket, listMyTickets, getMyTicket };
export default ticketsApi;
