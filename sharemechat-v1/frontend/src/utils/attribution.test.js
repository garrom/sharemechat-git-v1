import {
  analyticsConsentGranted,
  readAttribution,
  getAcquisitionPayload,
  pushSignUp,
} from './attribution';

/**
 * ADR-059 Fase 4 (frontend): tests del util de ATRIBUCIÓN de origen (ADR-057,
 * capa A/B). Compliance/PII-sensible: TODO va gateado por consentimiento
 * (`localStorage['smc_cookie_consent'] === 'accepted'`). Cubre: el gate de
 * consentimiento, el payload de adquisición para el backend (capa B), la lectura
 * de la cookie first-touch, y el evento sign_up (que en NO-prod — jsdom es
 * localhost — NO llega a GA4, va a `window.__smcAttribution`).
 *
 * Se controlan `localStorage` (consentimiento) y `document.cookie` (first-touch),
 * ambos reales en jsdom.
 */

const CONSENT_KEY = 'smc_cookie_consent';
const COOKIE = 'smc_attribution';

const setConsent = (v) => window.localStorage.setItem(CONSENT_KEY, v);
const setAttributionCookie = (obj) => {
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(obj))}; Path=/`;
};

beforeEach(() => {
  window.localStorage.clear();
  document.cookie = `${COOKIE}=; Max-Age=0; Path=/`; // limpia la cookie
  delete window.__smcAttribution;
  delete window.dataLayer;
});

describe('attribution · consentimiento', () => {
  test('analyticsConsentGranted: solo "accepted" cuenta como consentimiento', () => {
    expect(analyticsConsentGranted()).toBe(false); // ausente
    setConsent('rejected');
    expect(analyticsConsentGranted()).toBe(false);
    setConsent('accepted');
    expect(analyticsConsentGranted()).toBe(true);
  });
});

describe('attribution · getAcquisitionPayload (capa B)', () => {
  test('sin consentimiento -> null (aunque haya cookie)', () => {
    setAttributionCookie({ s: 'google', m: 'cpc', c: 'camp' });
    expect(getAcquisitionPayload()).toBeNull();
  });

  test('con consentimiento pero sin cookie -> null', () => {
    setConsent('accepted');
    expect(getAcquisitionPayload()).toBeNull();
  });

  test('con consentimiento y cookie -> payload de atribución', () => {
    setConsent('accepted');
    setAttributionCookie({ s: 'google', m: 'cpc', c: 'verano', rf: 'ref.com', lp: '/landing' });
    expect(getAcquisitionPayload()).toEqual({
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: 'verano',
      referrerHost: 'ref.com',
      landingPath: '/landing',
    });
  });
});

describe('attribution · readAttribution', () => {
  test('sin cookie -> direct', () => {
    expect(readAttribution()).toEqual({ source: 'direct', medium: '(none)', campaign: '(none)' });
  });

  test('con cookie -> fuente parseada', () => {
    setAttributionCookie({ s: 'newsletter', m: 'email', c: 'agosto' });
    expect(readAttribution()).toEqual({ source: 'newsletter', medium: 'email', campaign: 'agosto' });
  });
});

describe('attribution · pushSignUp', () => {
  test('sin consentimiento: no emite ningún evento', () => {
    pushSignUp({ userType: 'client' });
    expect(window.__smcAttribution).toBeUndefined();
    expect(window.dataLayer).toBeUndefined();
  });

  test('con consentimiento en NO-prod (localhost): registra en __smcAttribution, no en dataLayer', () => {
    setConsent('accepted');
    setAttributionCookie({ s: 'google', m: 'cpc', c: 'verano' });

    pushSignUp({ userType: 'model' });

    expect(window.dataLayer).toBeUndefined(); // NO contamina GA4 fuera de prod
    expect(window.__smcAttribution).toHaveLength(1);
    expect(window.__smcAttribution[0]).toMatchObject({
      event: 'sign_up',
      user_type: 'model',
      utm_source: 'google',
      environment: 'local',
    });
  });
});
