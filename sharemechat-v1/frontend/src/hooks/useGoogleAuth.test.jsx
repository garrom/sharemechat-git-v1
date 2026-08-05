import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import useGoogleAuth from './useGoogleAuth';

/**
 * Tests unitarios del hook useGoogleAuth (ADR-058).
 *
 * Cubre los 7 caminos del handler:
 * 1. 200 exitoso → refresh + safeNavigate + onLoginSuccess.
 * 2. 409 EMAIL_COLLISION_NEEDS_PASSWORD → setError con mensaje del backend.
 * 3. 404 NO_ACCOUNT_FOR_EMAIL → setError con mensaje del backend.
 * 4. 503 GOOGLE_AUTH_UNAVAILABLE → setError con i18n unavailable.
 * 5. 401 sin code → setError invalidToken.
 * 6. 403 sin code → setError accessDenied.
 * 7. Error genérico → setError con mensaje del error o generic.
 *
 * Mockea:
 * - apiFetch (config/http): simula respuestas del backend.
 * - resolveHomeUrl (utils/runtimeSurface): devuelve URL determinista.
 * - i18n: passthrough con la key (para verificar qué key se usa).
 */

jest.mock('../config/http');
jest.mock('../utils/runtimeSurface', () => ({
  resolveHomeUrl: jest.fn(() => '/home-mock'),
}));
jest.mock('../i18n', () => ({
  t: (key) => key,
  language: 'es',
}));

import { apiFetch } from '../config/http';
import { resolveHomeUrl } from '../utils/runtimeSurface';

/**
 * Componente host de test que consume el hook y expone un botón
 * para dispararlo. Recibe todos los callbacks por props.
 */
function TestHost({
  setError,
  setStatus,
  setLoading,
  refresh,
  safeNavigate,
  onLoginSuccess,
  intent = 'login',
  idToken = 'fake.jwt.token',
}) {
  const handleGoogleAuth = useGoogleAuth({
    setError,
    setStatus,
    setLoading,
    refresh,
    safeNavigate,
    onLoginSuccess,
  });
  return (
    <button type="button" onClick={() => handleGoogleAuth(idToken, intent)}>
      trigger
    </button>
  );
}

function renderHost(overrides = {}) {
  const callbacks = {
    setError: jest.fn(),
    setStatus: jest.fn(),
    setLoading: jest.fn(),
    refresh: jest.fn().mockResolvedValue({ role: 'CLIENT', id: 42 }),
    safeNavigate: jest.fn(),
    onLoginSuccess: jest.fn(),
    ...overrides,
  };
  render(<TestHost {...callbacks} />);
  return callbacks;
}

beforeEach(() => {
  jest.clearAllMocks();
  // Re-establecer implementación (clearAllMocks no siempre la preserva de
  // forma predecible en jest 27 con react-scripts 5.0.1).
  resolveHomeUrl.mockReturnValue('/home-mock');
});

describe('useGoogleAuth', () => {
  test('camino feliz 200: apiFetch OK → refresh + safeNavigate + onLoginSuccess', async () => {
    apiFetch.mockResolvedValueOnce({});
    const cbs = renderHost();

    await userEvent.click(screen.getByText('trigger'));

    await waitFor(() => expect(cbs.refresh).toHaveBeenCalledTimes(1));
    expect(apiFetch).toHaveBeenCalledWith('/auth/google', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"idToken":"fake.jwt.token"'),
    }));
    expect(cbs.safeNavigate).toHaveBeenCalledWith('/home-mock');
    expect(cbs.onLoginSuccess).toHaveBeenCalledTimes(1);
    expect(cbs.setError).toHaveBeenCalledWith('');
    expect(cbs.setStatus).toHaveBeenCalledWith('auth.login.status.successRedirecting');
    expect(cbs.setLoading).toHaveBeenLastCalledWith(false);
  });

  test('409 EMAIL_COLLISION_NEEDS_PASSWORD → setError con mensaje backend', async () => {
    apiFetch.mockRejectedValueOnce({
      status: 409,
      data: { code: 'EMAIL_COLLISION_NEEDS_PASSWORD', message: 'Backend msg' },
    });
    const cbs = renderHost();

    await userEvent.click(screen.getByText('trigger'));

    await waitFor(() => expect(cbs.setError).toHaveBeenCalledWith('Backend msg'));
    expect(cbs.refresh).not.toHaveBeenCalled();
    expect(cbs.safeNavigate).not.toHaveBeenCalled();
    expect(cbs.onLoginSuccess).not.toHaveBeenCalled();
    expect(cbs.setLoading).toHaveBeenLastCalledWith(false);
  });

  test('409 EMAIL_COLLISION sin message → fallback a i18n key', async () => {
    apiFetch.mockRejectedValueOnce({
      status: 409,
      data: { code: 'EMAIL_COLLISION_NEEDS_PASSWORD' },
    });
    const cbs = renderHost();

    await userEvent.click(screen.getByText('trigger'));

    await waitFor(() =>
      expect(cbs.setError).toHaveBeenCalledWith('auth.google.errors.emailCollision'),
    );
  });

  test('404 NO_ACCOUNT_FOR_EMAIL → setError con mensaje backend', async () => {
    apiFetch.mockRejectedValueOnce({
      status: 404,
      data: { code: 'NO_ACCOUNT_FOR_EMAIL', message: 'No cuenta' },
    });
    const cbs = renderHost();

    await userEvent.click(screen.getByText('trigger'));

    await waitFor(() => expect(cbs.setError).toHaveBeenCalledWith('No cuenta'));
  });

  test('503 GOOGLE_AUTH_UNAVAILABLE → setError con i18n unavailable (sin backend message)', async () => {
    apiFetch.mockRejectedValueOnce({
      status: 503,
      data: { code: 'GOOGLE_AUTH_UNAVAILABLE' },
    });
    const cbs = renderHost();

    await userEvent.click(screen.getByText('trigger'));

    await waitFor(() =>
      expect(cbs.setError).toHaveBeenCalledWith('auth.google.errors.unavailable'),
    );
  });

  test('401 sin code → setError invalidToken', async () => {
    apiFetch.mockRejectedValueOnce({ status: 401 });
    const cbs = renderHost();

    await userEvent.click(screen.getByText('trigger'));

    await waitFor(() =>
      expect(cbs.setError).toHaveBeenCalledWith('auth.google.errors.invalidToken'),
    );
  });

  test('403 sin code → setError accessDenied', async () => {
    apiFetch.mockRejectedValueOnce({ status: 403 });
    const cbs = renderHost();

    await userEvent.click(screen.getByText('trigger'));

    await waitFor(() =>
      expect(cbs.setError).toHaveBeenCalledWith('auth.login.errors.accessDenied'),
    );
  });

  test('error genérico sin status ni data → setError con err.message', async () => {
    apiFetch.mockRejectedValueOnce({ message: 'Network kaput' });
    const cbs = renderHost();

    await userEvent.click(screen.getByText('trigger'));

    await waitFor(() => expect(cbs.setError).toHaveBeenCalledWith('Network kaput'));
  });

  test('error sin message ni status → setError con i18n generic', async () => {
    apiFetch.mockRejectedValueOnce({});
    const cbs = renderHost();

    await userEvent.click(screen.getByText('trigger'));

    await waitFor(() =>
      expect(cbs.setError).toHaveBeenCalledWith('auth.login.errors.generic'),
    );
  });

  test('setLoading true al arrancar, false al terminar (éxito y error)', async () => {
    apiFetch.mockResolvedValueOnce({});
    const cbs = renderHost();

    await userEvent.click(screen.getByText('trigger'));

    // Primera llamada true, última false
    await waitFor(() => expect(cbs.setLoading).toHaveBeenCalledTimes(2));
    expect(cbs.setLoading).toHaveBeenNthCalledWith(1, true);
    expect(cbs.setLoading).toHaveBeenNthCalledWith(2, false);
  });

  test('intent y locale se serializan correctamente en el body', async () => {
    apiFetch.mockResolvedValueOnce({});
    renderHost({ intent: 'register-client', idToken: 'X' });
    // Necesitamos re-render para el intent nuevo — simplemente disparamos
    // (el helper renderHost ya usa esos props).
    await userEvent.click(screen.getByText('trigger'));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const [, opts] = apiFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.intent).toBe('register-client');
    expect(body.idToken).toBe('X');
    expect(body.locale).toBe('es');
  });
});
