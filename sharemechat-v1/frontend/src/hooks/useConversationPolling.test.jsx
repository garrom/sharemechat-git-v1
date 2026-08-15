import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import useConversationPolling from './useConversationPolling';
import { apiFetch } from '../config/http';

/**
 * ADR-059 Fase 4 (frontend): tests del hook `useConversationPolling` (soporte
 * admin, ADR-046). Hace fetch inicial del detalle de la conversación y luego
 * polling cada `max(pollingSec,3)s` mientras `enabled` y la pestaña esté visible;
 * dedup con inFlight; expone `refresh()`.
 *
 * Patrón hooks: componente HARNESS + mock del seam (`apiFetch`). El caso de
 * polling usa FAKE TIMERS: se flushean microtasks con `await act(async()=>{})`
 * antes de avanzar el intervalo, y se asserta el nº de llamadas a `apiFetch`.
 */

jest.mock('../config/http', () => ({ apiFetch: jest.fn() }));

function Host({ conversationId, enabled = true, pollingSec = 3 }) {
  const { data, error, refresh } = useConversationPolling(conversationId, { enabled, pollingSec });
  return (
    <div>
      <div data-testid="data">{data ? data.marker : 'NODATA'}</div>
      <div data-testid="error">{error ? 'ERR' : 'OK'}</div>
      <button type="button" onClick={refresh}>refresh</button>
    </div>
  );
}

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe('useConversationPolling', () => {
  test('fetch inicial: llama al endpoint y expone data', async () => {
    apiFetch.mockResolvedValue({ marker: 'conv-data' });
    render(<Host conversationId={5} />);

    expect(await screen.findByText('conv-data')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/admin/support/conversations/5');
  });

  test('polling: vuelve a consultar al cumplirse el intervalo', async () => {
    jest.useFakeTimers();
    apiFetch.mockResolvedValue({ marker: 'x' });
    render(<Host conversationId={7} pollingSec={3} />);

    await act(async () => {}); // flush del fetch inicial
    expect(apiFetch).toHaveBeenCalledTimes(1);

    await act(async () => { jest.advanceTimersByTime(3000); }); // dispara el intervalo
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  test('enabled=false: hace el fetch inicial pero NO pollea', async () => {
    jest.useFakeTimers();
    apiFetch.mockResolvedValue({ marker: 'x' });
    render(<Host conversationId={9} enabled={false} pollingSec={3} />);

    await act(async () => {});
    expect(apiFetch).toHaveBeenCalledTimes(1);

    await act(async () => { jest.advanceTimersByTime(9000); }); // 3 intervalos
    expect(apiFetch).toHaveBeenCalledTimes(1); // sin polling
  });

  test('sin conversationId: no consulta', () => {
    render(<Host conversationId={null} />);
    expect(screen.getByTestId('data')).toHaveTextContent('NODATA');
    expect(apiFetch).not.toHaveBeenCalled();
  });

  test('refresh() manual dispara una nueva consulta', async () => {
    apiFetch.mockResolvedValue({ marker: 'conv-data' });
    render(<Host conversationId={5} />);
    await screen.findByText('conv-data'); // fetch inicial resuelto

    fireEvent.click(screen.getByText('refresh'));
    await act(async () => {});

    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  test('error del backend: expone error y no rompe', async () => {
    apiFetch.mockRejectedValue(new Error('boom'));
    render(<Host conversationId={5} />);

    expect(await screen.findByText('ERR')).toBeInTheDocument();
    expect(screen.getByTestId('data')).toHaveTextContent('NODATA');
  });
});
