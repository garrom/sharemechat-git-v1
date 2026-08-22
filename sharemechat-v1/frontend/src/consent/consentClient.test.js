// Compliance (age-gate / términos): consentClient gestiona los flags locales por
// VERSIÓN, el consent_id en cookie, y el envío de beacons de consentimiento
// (sendBeacon con fallback a fetch). Un bug aquí rompe el registro legal.

import {
  TERMS_VERSION,
  ensureConsentId,
  setLocalAgeOk,
  setLocalTermsOk,
  isLocalAgeOk,
  isLocalTermsOk,
  clearLocalAgeOk,
  clearLocalTermsOk,
  logAgeGateAccept,
  logTermsAccept,
} from './consentClient';

function clearCookies() {
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0].trim();
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`;
  });
}

beforeEach(() => {
  window.localStorage.clear();
  clearCookies();
  Object.defineProperty(window.navigator, 'sendBeacon', {
    value: jest.fn(() => true),
    configurable: true,
    writable: true,
  });
  global.fetch = jest.fn(() => Promise.resolve({ ok: true }));
});

describe('flags locales de age / terms', () => {
  test('set / is / clear age (versión por defecto)', () => {
    expect(isLocalAgeOk()).toBe(false);
    setLocalAgeOk();
    expect(isLocalAgeOk()).toBe(true);
    expect(window.localStorage.getItem(`age_ok_${TERMS_VERSION}`)).toBe('true');
    clearLocalAgeOk();
    expect(isLocalAgeOk()).toBe(false);
  });

  test('set / is / clear terms (versión por defecto)', () => {
    expect(isLocalTermsOk()).toBe(false);
    setLocalTermsOk();
    expect(isLocalTermsOk()).toBe(true);
    clearLocalTermsOk();
    expect(isLocalTermsOk()).toBe(false);
  });

  test('las keys son por VERSIÓN: v1 no vale para v2', () => {
    setLocalAgeOk('v1');
    expect(isLocalAgeOk('v1')).toBe(true);
    expect(isLocalAgeOk('v2')).toBe(false);
    setLocalAgeOk('v2');
    expect(window.localStorage.getItem('age_ok_v2')).toBe('true');
    expect(isLocalAgeOk('v2')).toBe(true);
  });
});

describe('ensureConsentId', () => {
  test('genera y persiste consent_id en cookie; es idempotente', () => {
    expect(document.cookie).not.toMatch(/consent_id=/);
    const id1 = ensureConsentId();
    expect(id1).toBeTruthy();
    expect(document.cookie).toMatch(/consent_id=/);
    const id2 = ensureConsentId();
    expect(id2).toBe(id1); // reusa el de la cookie, no regenera
  });
});

describe('beacons de consentimiento', () => {
  test('logAgeGateAccept -> sendBeacon a /api/consent/age-gate + asegura consent_id', async () => {
    const ok = await logAgeGateAccept('/x');
    expect(ok).toBe(true);
    expect(window.navigator.sendBeacon).toHaveBeenCalled();
    const [url] = window.navigator.sendBeacon.mock.calls[0];
    expect(url).toBe('/api/consent/age-gate');
    expect(document.cookie).toMatch(/consent_id=/);
    expect(global.fetch).not.toHaveBeenCalled(); // sendBeacon OK -> sin fallback
  });

  test('logTermsAccept -> incluye la versión en la URL', async () => {
    await logTermsAccept('v1', '/y');
    const [url] = window.navigator.sendBeacon.mock.calls[0];
    expect(url).toBe('/api/consent/terms?v=v1');
  });

  test('fallback a fetch si sendBeacon falla (devuelve false)', async () => {
    window.navigator.sendBeacon = jest.fn(() => false);
    const ok = await logAgeGateAccept('/z');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/consent/age-gate',
      expect.objectContaining({ method: 'POST', keepalive: true }),
    );
    expect(ok).toBe(true);
  });
});
