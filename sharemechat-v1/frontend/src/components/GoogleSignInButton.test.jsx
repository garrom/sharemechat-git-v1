import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import GoogleSignInButton from './GoogleSignInButton';

/**
 * Tests del componente GoogleSignInButton (ADR-058).
 *
 * Cubre los 4 caminos críticos:
 * 1. Sin REACT_APP_GOOGLE_OAUTH_CLIENT_ID → muestra aviso, no renderiza botón.
 * 2. Con clientId pero sin script GIS cargado tras 3s → error timeout.
 * 3. Con clientId y GIS ya cargado → initialize + renderButton se invocan
 *    con los parámetros esperados.
 * 4. Callback GIS con credential → onIdToken se llama con el token+intent.
 *
 * Mock de window.google.accounts.id porque el script GIS real se carga
 * desde CDN externa (bloqueada por CSP en tests).
 */

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
  // Limpia cualquier mock global de la biblioteca GIS entre tests.
  delete window.google;
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('GoogleSignInButton', () => {
  test('sin REACT_APP_GOOGLE_OAUTH_CLIENT_ID muestra aviso', () => {
    delete process.env.REACT_APP_GOOGLE_OAUTH_CLIENT_ID;
    render(<GoogleSignInButton onIdToken={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      /no está configurado/i
    );
    expect(screen.queryByTestId('google-signin-button')).not.toBeInTheDocument();
  });

  test('con clientId y GIS ya cargado inicializa e invoca renderButton', async () => {
    process.env.REACT_APP_GOOGLE_OAUTH_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
    const initialize = jest.fn();
    const renderButton = jest.fn();
    window.google = { accounts: { id: { initialize, renderButton } } };

    render(<GoogleSignInButton onIdToken={() => {}} intent="login" />);

    await waitFor(() => expect(initialize).toHaveBeenCalled());
    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: 'test-client-id.apps.googleusercontent.com',
        use_fedcm_for_prompt: true,
        callback: expect.any(Function),
      })
    );
    await waitFor(() => expect(renderButton).toHaveBeenCalled());
    // Width se mide del contenedor (JSDOM getBoundingClientRect=0 → clamp a 200).
    // Solo comprobamos que sea un número dentro del rango permitido por GIS.
    const [, opts] = renderButton.mock.calls[0];
    expect(opts).toEqual(
      expect.objectContaining({
        text: 'signin_with',
        theme: 'outline',
        size: 'large',
      })
    );
    expect(opts.width).toBeGreaterThanOrEqual(200);
    expect(opts.width).toBeLessThanOrEqual(400);
    expect(screen.getByTestId('google-signin-button')).toHaveAttribute('data-ready', 'true');
  });

  test('intent=register-client usa text=signup_with', async () => {
    process.env.REACT_APP_GOOGLE_OAUTH_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
    const renderButton = jest.fn();
    window.google = {
      accounts: { id: { initialize: jest.fn(), renderButton } },
    };
    render(<GoogleSignInButton onIdToken={() => {}} intent="register-client" />);
    await waitFor(() => expect(renderButton).toHaveBeenCalled());
    expect(renderButton).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ text: 'signup_with' })
    );
  });

  test('callback de GIS con credential invoca onIdToken con token e intent', async () => {
    process.env.REACT_APP_GOOGLE_OAUTH_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
    let capturedCallback;
    const initialize = jest.fn((cfg) => {
      capturedCallback = cfg.callback;
    });
    window.google = {
      accounts: { id: { initialize, renderButton: jest.fn() } },
    };
    const onIdToken = jest.fn();

    render(<GoogleSignInButton onIdToken={onIdToken} intent="register-client" />);
    await waitFor(() => expect(initialize).toHaveBeenCalled());

    // Simula que Google llama la callback con un ID token.
    capturedCallback({ credential: 'fake.jwt.token' });
    expect(onIdToken).toHaveBeenCalledWith('fake.jwt.token', 'register-client');
  });

  test('callback de GIS sin credential invoca onError', async () => {
    process.env.REACT_APP_GOOGLE_OAUTH_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
    let capturedCallback;
    const initialize = jest.fn((cfg) => { capturedCallback = cfg.callback; });
    window.google = {
      accounts: { id: { initialize, renderButton: jest.fn() } },
    };
    const onError = jest.fn();

    render(<GoogleSignInButton onIdToken={() => {}} onError={onError} />);
    await waitFor(() => expect(initialize).toHaveBeenCalled());

    capturedCallback({}); // sin .credential
    expect(onError).toHaveBeenCalledWith(expect.stringMatching(/sin credencial/i));
  });

  test('sin script GIS tras 3s muestra aviso adblocker', async () => {
    jest.useFakeTimers();
    process.env.REACT_APP_GOOGLE_OAUTH_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
    // window.google NO se define -> el polling fallará.
    render(<GoogleSignInButton onIdToken={() => {}} />);
    // Avanza 3.1s de fake timer para agotar los 30 intentos.
    act(() => { jest.advanceTimersByTime(3100); });
    expect(screen.getByRole('alert')).toHaveTextContent(/adblocker/i);
    jest.useRealTimers();
  });
});
