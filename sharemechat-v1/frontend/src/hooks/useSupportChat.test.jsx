// ADR-059 Fase 4 — useSupportChat: hook del chat de soporte (bot IA + humano).
// Optimistic USER message, reply LLM/SYSTEM, rate-limit, escalado, cache de
// conversationId en localStorage, y modo "pinned" scoped a un ticket (ADR-054).
// Patrón harness-captura-API + mock del seam `supportApi`.

import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import useSupportChat from './useSupportChat';
import { supportApi } from '../api/supportApi';

jest.mock('../api/supportApi', () => ({
  supportApi: {
    getHistory: jest.fn(),
    getConversationMeta: jest.fn(),
    sendMessage: jest.fn(),
    sendTicketMessage: jest.fn(),
    escalateManual: jest.fn(),
  },
}));

const LS_KEY = 'sharemechat.support.conversationId';

let api;
function Host({ options }) {
  api = useSupportChat(options);
  return null;
}
const renderHook = (options) => render(<Host options={options} />);

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  supportApi.getHistory.mockResolvedValue([]);
  supportApi.getConversationMeta.mockResolvedValue(null);
});

test('sin conversación cacheada -> conversationId null, no consulta historial', async () => {
  renderHook();
  expect(api.conversationId).toBeNull();
  expect(api.messages).toEqual([]);
  await Promise.resolve();
  expect(supportApi.getHistory).not.toHaveBeenCalled();
});

test('conversación cacheada en localStorage -> carga historial al montar', async () => {
  localStorage.setItem(LS_KEY, '5');
  supportApi.getHistory.mockResolvedValue([{ id: 1, sender: 'USER', content: 'hola' }]);
  renderHook();
  await waitFor(() => expect(api.messages).toHaveLength(1));
  expect(supportApi.getHistory).toHaveBeenCalledWith(5);
  expect(api.conversationId).toBe(5);
});

test('sendMessage: optimistic USER + reply LLM, actualiza rateLimitState', async () => {
  localStorage.setItem(LS_KEY, '7');
  supportApi.sendMessage.mockResolvedValue({
    conversationId: 7, reply: 'respuesta bot', messageId: 99,
    rateLimited: false, messagesRemainingToday: 29, tokensRemainingToday: 40000,
  });
  renderHook();
  await waitFor(() => expect(supportApi.getHistory).toHaveBeenCalledWith(7));

  await act(async () => { await api.sendMessage('  hola  '); }); // se hace trim

  await waitFor(() => expect(api.messages.map((m) => m.content)).toEqual(['hola', 'respuesta bot']));
  expect(supportApi.sendMessage).toHaveBeenCalledWith('hola');
  expect(api.messages[0].sender).toBe('USER');
  expect(api.messages[1].sender).toBe('LLM');
  expect(api.rateLimitState.messagesRemainingToday).toBe(29);
  expect(api.rateLimitState.rateLimited).toBe(false);
});

test('sendMessage vacío/espacios -> no llama al backend', async () => {
  renderHook();
  await act(async () => { await api.sendMessage('   '); });
  expect(supportApi.sendMessage).not.toHaveBeenCalled();
});

test('respuesta rateLimited -> reply SYSTEM + rateLimited=true; siguiente envío se ignora', async () => {
  localStorage.setItem(LS_KEY, '7');
  supportApi.sendMessage.mockResolvedValue({ conversationId: 7, reply: 'has llegado al límite', rateLimited: true });
  renderHook();
  await waitFor(() => expect(supportApi.getHistory).toHaveBeenCalled());

  await act(async () => { await api.sendMessage('uno'); });
  await waitFor(() => expect(api.rateLimitState.rateLimited).toBe(true));
  expect(api.messages[api.messages.length - 1].sender).toBe('SYSTEM');

  await act(async () => { await api.sendMessage('dos'); });
  expect(supportApi.sendMessage).toHaveBeenCalledTimes(1); // el 2º no salió
});

test('error al enviar -> quita el mensaje optimista y expone error', async () => {
  localStorage.setItem(LS_KEY, '7');
  supportApi.sendMessage.mockRejectedValue(new Error('boom red'));
  renderHook();
  await waitFor(() => expect(supportApi.getHistory).toHaveBeenCalled());

  await act(async () => { await api.sendMessage('hola'); });
  await waitFor(() => expect(api.error).toBe('boom red'));
  expect(api.messages).toEqual([]); // el pending se revirtió
});

test('requestEscalation: sin conversación lanza; con conversación marca ESCALATED', async () => {
  renderHook();
  await expect(api.requestEscalation('motivo')).rejects.toThrow(/No hay conversación activa/);

  localStorage.setItem(LS_KEY, '7');
  supportApi.escalateManual.mockResolvedValue({ resolutionStatus: 'ESCALATED' });
  renderHook();
  await waitFor(() => expect(supportApi.getHistory).toHaveBeenCalledWith(7));
  await act(async () => { await api.requestEscalation('urgente'); });
  expect(supportApi.escalateManual).toHaveBeenCalledWith(7, 'urgente');
  expect(api.resolutionStatus).toBe('ESCALATED');
  expect(api.escalated).toBe(true);
});

test('clearConversation -> resetea estado y borra el cache de localStorage', async () => {
  localStorage.setItem(LS_KEY, '7');
  renderHook();
  await waitFor(() => expect(api.conversationId).toBe(7));
  await act(async () => { api.clearConversation(); });
  expect(api.conversationId).toBeNull();
  expect(api.messages).toEqual([]);
  await waitFor(() => expect(localStorage.getItem(LS_KEY)).toBeNull());
});

test('entrar en HUMAN_HANDLING dispara un refetch inmediato del historial', async () => {
  localStorage.setItem(LS_KEY, '7');
  supportApi.sendMessage.mockResolvedValue({ conversationId: 7, reply: 'te atiende un agente', resolutionStatus: 'HUMAN_HANDLING' });
  renderHook();
  await waitFor(() => expect(supportApi.getHistory).toHaveBeenCalledTimes(1)); // carga inicial

  await act(async () => { await api.sendMessage('ayuda'); });
  await waitFor(() => expect(api.resolutionStatus).toBe('HUMAN_HANDLING'));
  // el efecto de HUMAN_HANDLING hace un refreshHistoryOnce inmediato
  await waitFor(() => expect(supportApi.getHistory.mock.calls.length).toBeGreaterThanOrEqual(2));
});

describe('modo pinned (vista de ticket, ADR-054)', () => {
  test('carga meta, NO escribe localStorage, y envía por el endpoint scoped', async () => {
    supportApi.getConversationMeta.mockResolvedValue({ resolutionStatus: null, assignedProfileName: 'Ana' });
    supportApi.sendTicketMessage.mockResolvedValue({ reply: 'acuse', resolutionStatus: null });
    renderHook({ pinnedConversationId: 42 });

    await waitFor(() => expect(api.meta).toEqual({ resolutionStatus: null, assignedProfileName: 'Ana' }));
    expect(supportApi.getConversationMeta).toHaveBeenCalledWith(42);
    expect(localStorage.getItem(LS_KEY)).toBeNull(); // pinned no persiste

    await act(async () => { await api.sendMessage('hola ticket'); });
    expect(supportApi.sendTicketMessage).toHaveBeenCalledWith(42, 'hola ticket');
    expect(supportApi.sendMessage).not.toHaveBeenCalled();
    // en pinned el reply es SYSTEM (acuse sin bot)
    expect(api.messages[api.messages.length - 1].sender).toBe('SYSTEM');
  });
});
