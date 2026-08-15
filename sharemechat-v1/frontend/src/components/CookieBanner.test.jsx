// ADR-059 Fase 4 — CookieBanner: consentimiento de cookies (GDPR). Visibilidad
// gobernada por localStorage 'smc_cookie_consent'; accept/configure/reject
// persisten la elección; accept además dispara captureFirstTouch (atribución).

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CookieBanner from './CookieBanner';
import { captureFirstTouch } from '../utils/attribution';

jest.mock('../i18n', () => ({ __esModule: true, default: { t: (k) => k } }));
jest.mock('../utils/attribution', () => ({ captureFirstTouch: jest.fn() }));

const CONSENT_KEY = 'smc_cookie_consent';

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

test('sin consentimiento previo -> banner visible con las 3 acciones', () => {
  render(<CookieBanner />);
  expect(screen.getByText('common.cookies.bannerText', { exact: false })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'common.cookies.acceptAll' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'common.cookies.configure' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'common.cookies.continueWithoutAccepting' })).toBeInTheDocument();
});

test('con consentimiento previo -> banner NO se muestra', () => {
  localStorage.setItem(CONSENT_KEY, 'accepted');
  render(<CookieBanner />);
  expect(screen.queryByRole('button', { name: 'common.cookies.acceptAll' })).toBeNull();
});

test('aceptar -> persiste "accepted", captura first-touch y oculta el banner', () => {
  render(<CookieBanner />);
  fireEvent.click(screen.getByRole('button', { name: 'common.cookies.acceptAll' }));
  expect(localStorage.getItem(CONSENT_KEY)).toBe('accepted');
  expect(captureFirstTouch).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'common.cookies.acceptAll' })).toBeNull();
});

test('configurar -> persiste "configured", NO captura first-touch, oculta', () => {
  render(<CookieBanner />);
  fireEvent.click(screen.getByRole('button', { name: 'common.cookies.configure' }));
  expect(localStorage.getItem(CONSENT_KEY)).toBe('configured');
  expect(captureFirstTouch).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'common.cookies.configure' })).toBeNull();
});

test('continuar sin aceptar -> persiste "rejected", NO captura first-touch, oculta', () => {
  render(<CookieBanner />);
  fireEvent.click(screen.getByRole('button', { name: 'common.cookies.continueWithoutAccepting' }));
  expect(localStorage.getItem(CONSENT_KEY)).toBe('rejected');
  expect(captureFirstTouch).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'common.cookies.continueWithoutAccepting' })).toBeNull();
});

test('si localStorage.getItem lanza al leer -> banner visible (fail-open a mostrar)', () => {
  const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  render(<CookieBanner />);
  expect(screen.getByRole('button', { name: 'common.cookies.acceptAll' })).toBeInTheDocument();
  spy.mockRestore();
});
