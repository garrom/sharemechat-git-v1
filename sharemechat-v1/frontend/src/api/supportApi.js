// Cliente REST del sub-paquete Chat Soporte LLM (B.2.1b).
// Consume los endpoints backend cerrados en B.1 (message + escalate manual)
// y B.2.1a (historial).
//
// Todos los helpers usan `apiFetch` para heredar auth (cookie access_token),
// refresh transparente y detección de mantenimiento.

import { apiFetch } from '../config/http';

const MAX_USER_MESSAGE_LENGTH = 4000;

/**
 * Envía un mensaje al Agente IA y devuelve la respuesta completa del backend.
 *
 * @param {string} text - mensaje del usuario. Máximo 4000 chars.
 * @returns {Promise<{
 *   conversationId: number,
 *   messageId: number|null,
 *   reply: string,
 *   resolutionStatus: 'OPEN'|'ESCALATED'|'RESOLVED'|'RATE_LIMITED'|string,
 *   rateLimited: boolean|null,
 *   escalated: boolean|null,
 *   escalationReason: string|null,
 *   messagesRemainingToday: number,
 *   tokensRemainingToday: number,
 *   timestamp: string,
 * }>}
 */
export async function sendMessage(text) {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) throw new Error('Mensaje vacío');
  const body = trimmed.length > MAX_USER_MESSAGE_LENGTH
    ? trimmed.slice(0, MAX_USER_MESSAGE_LENGTH)
    : trimmed;
  return apiFetch('/support/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: body }),
  });
}

/**
 * Carga el historial completo de una conversación de soporte.
 * El backend valida que la conversación pertenezca al user autenticado;
 * si no, devuelve 400 con "Conversacion no encontrada".
 *
 * @param {number|string} conversationId
 * @returns {Promise<Array<{id: number, conversationId: number, sender: 'USER'|'LLM'|'SYSTEM', content: string, createdAt: string}>>}
 */
export async function getHistory(conversationId) {
  if (!conversationId) throw new Error('conversationId requerido');
  return apiFetch(`/support/conversations/${encodeURIComponent(conversationId)}/messages`);
}

/**
 * Escala la conversación a un humano (soporte tier-2).
 *
 * @param {number|string} conversationId
 * @param {string} [reason] - motivo opcional (trim a 500 chars server-side).
 * @returns {Promise<{conversationId: number, resolutionStatus: string, escalationReason: string}>}
 */
export async function escalateManual(conversationId, reason) {
  if (!conversationId) throw new Error('conversationId requerido');
  const payload = {};
  if (reason && typeof reason === 'string' && reason.trim()) {
    payload.reason = reason.trim();
  }
  return apiFetch(`/support/conversations/${encodeURIComponent(conversationId)}/escalate-manual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export const supportApi = { sendMessage, getHistory, escalateManual };
export default supportApi;
