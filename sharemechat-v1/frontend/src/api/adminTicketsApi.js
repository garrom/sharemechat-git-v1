// ADR-054 T5: cliente admin del sistema de tickets.
// Consume /api/admin/tickets/** protegido por PERM_SUPPORT_TICKETS_HANDLE
// (ver SecurityConfig) y hereda auth cookie via apiFetch.

import { apiFetch } from '../config/http';

/** GET listado paginado + filtros opcionales category / status. */
export async function listTickets({ category, status, page = 0, size = 20 } = {}) {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (status) params.set('status', status);
  params.set('page', String(page));
  params.set('size', String(size));
  return apiFetch(`/admin/tickets?${params.toString()}`);
}

/** GET detalle. 404 si no existe. */
export async function getTicket(id) {
  if (!id) throw new Error('id requerido');
  return apiFetch(`/admin/tickets/${encodeURIComponent(id)}`);
}

/**
 * POST verify: ejecuta TicketVerificationService en el backend y devuelve
 * el JSON estructurado (string parseable) con signals + signalStrength +
 * recommendation. Persiste verification_last_* en el propio ticket.
 */
export async function verifyTicket(id) {
  if (!id) throw new Error('id requerido');
  return apiFetch(`/admin/tickets/${encodeURIComponent(id)}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * PATCH status: transiciona el ticket. El backend valida D6 (transiciones
 * enum). El destino RESOLVED_COMPENSATED NO se acepta aqui — usar
 * compensateTicket que llama al endpoint refund con ticketId.
 */
export async function transitionStatus(id, newStatus, notes) {
  if (!id) throw new Error('id requerido');
  if (!newStatus) throw new Error('newStatus requerido');
  return apiFetch(`/admin/tickets/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newStatus, notes }),
  });
}

/**
 * Compensa un ticket llamando al endpoint refund existente
 * (POST /admin/finance/refund/{userId}) con ticketId. El backend valida
 * que el ticket esté en RESOLVED_COMPENSATED_PENDING_CREDIT antes de
 * acreditar, y al terminar lo pasa a RESOLVED_COMPENSATED linkando la
 * Transaction creada.
 *
 * IMPORTANTE: el ticket debe pasar previamente a
 * RESOLVED_COMPENSATED_PENDING_CREDIT via transitionStatus. El modal
 * padre orquesta ambos pasos.
 */
export async function compensateTicket({ userId, ticketId, amount, reason }) {
  if (!userId || !ticketId) throw new Error('userId y ticketId requeridos');
  if (!amount || amount <= 0) throw new Error('amount > 0 requerido');
  return apiFetch(`/admin/finance/refund/${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount,
      operationType: 'MANUAL_REFUND',
      description: reason || `Compensacion ticket #${ticketId}`,
      ticketId,
    }),
  });
}

export const adminTicketsApi = {
  listTickets, getTicket, verifyTicket, transitionStatus, compensateTicket,
};
export default adminTicketsApi;
