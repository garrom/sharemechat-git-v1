import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import useSupportPendingCount from './useSupportPendingCount';
import { apiFetch } from '../config/http';

/**
 * ADR-059 Fase 4 (frontend): tests del hook `useSupportPendingCount` (badge de
 * escaladas del sidebar admin, ADR-046). Fetch inicial + polling cada
 * `max(pollingSec,5)s` mientras enabled y visible; dedup inFlight; refresh().
 * A diferencia de useConversationPolling, con `enabled=false` NO hace ni el fetch
 * inicial. Patrón polling con fake timers.
 */

jest.mock('../config/http', () => ({ apiFetch: jest.fn() }));

function Host({ enabled = true, pollingSec = 5 }) {
  const { counts, error, refresh } = useSupportPendingCount({ enabled, pollingSec });
  return (
    <div>
      <div data-testid="pending">{counts.pendingUnassigned}</div>
      <div data-testid="error">{error ? 'ERR' : 'OK'}</div>
      <button type="button" onClick={refresh}>refresh</button>
    </div>
  );
}

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe('useSupportPendingCount', () => {
  test('fetch inicial: consulta el endpoint y expone los contadores', async () => {
    apiFetch.mockResolvedValue({ pendingUnassigned: 3, myAssigned: 1, otherAssigned: 2 });
    render(<Host />);

    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/admin/support/pending-count');
  });

  test('polling: vuelve a consultar al cumplirse el intervalo', async () => {
    jest.useFakeTimers();
    apiFetch.mockResolvedValue({ pendingUnassigned: 0 });
    render(<Host pollingSec={5} />);

    await act(async () => {}); // flush del fetch inicial
    expect(apiFetch).toHaveBeenCalledTimes(1);

    await act(async () => { jest.advanceTimersByTime(5000); });
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  test('enabled=false: NO consulta (ni fetch inicial)', () => {
    render(<Host enabled={false} />);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  test('refresh() manual dispara una nueva consulta', async () => {
    apiFetch.mockResolvedValue({ pendingUnassigned: 3 });
    render(<Host />);
    await screen.findByText('3');

    fireEvent.click(screen.getByText('refresh'));
    await act(async () => {});

    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  test('error del backend: expone error y no rompe', async () => {
    apiFetch.mockRejectedValue(new Error('boom'));
    render(<Host />);

    expect(await screen.findByText('ERR')).toBeInTheDocument();
  });
});
