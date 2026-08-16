// ADR-059 Fase 4 — SessionProvider: ciclo de vida de sesión del frontend.
// En rutas públicas no consulta; en protegidas hace loadMe -> GET /users/me;
// 401/403 -> user null + evento 'auth:logout'; expone refresh y updateUiLocale
// (persiste vía PUT solo con sesión). Se mockean apiFetch, i18n, localeUtils.

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SessionProvider, useSession } from './SessionProvider';
import { apiFetch } from '../config/http';
import { setStoredLocale } from '../i18n/localeUtils';

jest.mock('../config/http', () => ({ apiFetch: jest.fn() }));
jest.mock('../i18n', () => ({ __esModule: true, default: { t: (k) => k, changeLanguage: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../i18n/localeUtils', () => ({
  getResolvedLocale: () => 'es',
  getUserUiLocale: () => null,
  normalizeLocale: (l) => l,
  setStoredLocale: jest.fn(),
}));
jest.mock('../utils/runtimeSurface', () => ({ isAdminSurface: () => false }));

function Probe() {
  const s = useSession();
  return (
    <div>
      <div data-testid="user">{s.user ? String(s.user.role) : 'null'}</div>
      <div data-testid="loading">{String(s.loading)}</div>
      <div data-testid="error">{s.error ? 'err' : 'noerr'}</div>
      <button onClick={() => s.refresh()}>refresh</button>
      <button onClick={() => s.updateUiLocale('en')}>setLocale</button>
    </div>
  );
}

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <SessionProvider><Probe /></SessionProvider>
    </MemoryRouter>
  );

let dispatchSpy;
beforeEach(() => {
  jest.clearAllMocks();
  dispatchSpy = jest.spyOn(window, 'dispatchEvent');
});
afterEach(() => jest.restoreAllMocks());

describe('rutas públicas (no consultan /users/me)', () => {
  test.each(['/', '/login', '/blog/algo', '/legal', '/faq'])('%s -> user null, sin apiFetch', async (path) => {
    renderAt(path);
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(apiFetch).not.toHaveBeenCalled();
    expect(screen.getByTestId('user').textContent).toBe('null');
  });
});

describe('rutas protegidas (loadMe)', () => {
  test('/client -> GET /users/me y expone el user', async () => {
    apiFetch.mockResolvedValue({ id: 1, role: 'CLIENT' });
    renderAt('/client');
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('CLIENT'));
    expect(apiFetch).toHaveBeenCalledWith('/users/me');
    expect(screen.getByTestId('loading').textContent).toBe('false');
  });

  test('401 -> user null + dispara evento auth:logout', async () => {
    apiFetch.mockRejectedValue({ status: 401 });
    renderAt('/client');
    await waitFor(() =>
      expect(dispatchSpy.mock.calls.some((c) => c[0]?.type === 'auth:logout')).toBe(true));
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  test('error genérico (500) -> expone error, NO dispara logout', async () => {
    apiFetch.mockRejectedValue({ status: 500 });
    renderAt('/client');
    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('err'));
    expect(dispatchSpy.mock.calls.some((c) => c[0]?.type === 'auth:logout')).toBe(false);
  });

  test('refresh() re-consulta /users/me', async () => {
    apiFetch.mockResolvedValue({ id: 1, role: 'CLIENT' });
    renderAt('/client');
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('CLIENT'));
    apiFetch.mockClear();
    await act(async () => { fireEvent.click(screen.getByText('refresh')); });
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/users/me'));
  });
});

describe('updateUiLocale', () => {
  test('sin sesión (ruta pública) -> persiste local (setStoredLocale) sin PUT', async () => {
    renderAt('/'); // público -> user null
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await act(async () => { fireEvent.click(screen.getByText('setLocale')); });
    expect(setStoredLocale).toHaveBeenCalledWith('en');
    expect(apiFetch).not.toHaveBeenCalledWith('/users/me/ui-locale', expect.anything());
  });

  test('con sesión -> PUT /users/me/ui-locale', async () => {
    apiFetch.mockImplementation((path) => {
      if (path === '/users/me') return Promise.resolve({ id: 1, role: 'CLIENT' });
      return Promise.resolve({ id: 1, role: 'CLIENT', uiLocale: 'en' });
    });
    renderAt('/client');
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('CLIENT'));
    await act(async () => { fireEvent.click(screen.getByText('setLocale')); });
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/users/me/ui-locale', expect.objectContaining({ method: 'PUT' })));
  });
});
