/**
 * ADR-059 Fase 4 (frontend): tests de `runtimeEnv` — detección de entorno por
 * hostname (build único para TEST/AUDIT/PROD) y el flag `isGoogleOAuthEnabled`
 * (ADR-058: Google Sign-In deshabilitado en PROD hasta publicar el consent).
 *
 * `runtimeEnv` resuelve los origins en MODULE LOAD leyendo `window.location`, así
 * que cada caso override el hostname y RE-IMPORTA el módulo (resetModules).
 */

const ORIGINAL_LOCATION = window.location;

const load = (hostname) => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { hostname, protocol: 'https:', search: '', pathname: '/' },
  });
  jest.resetModules();
  return require('./runtimeEnv');
};

afterAll(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: ORIGINAL_LOCATION });
});

describe('runtimeEnv', () => {
  test('host de TEST -> origins TEST, no es prod, Google habilitado', () => {
    const m = load('test.sharemechat.com');
    expect(m.PRODUCT_ORIGIN).toBe('https://test.sharemechat.com');
    expect(m.ADMIN_ORIGIN).toBe('https://admin.test.sharemechat.com');
    expect(m.IS_PROD_ENV).toBe(false);
    expect(m.isGoogleOAuthEnabled()).toBe(true);
  });

  test('host de PROD -> origins PROD, es prod, Google DESHABILITADO', () => {
    const m = load('sharemechat.com');
    expect(m.PRODUCT_ORIGIN).toBe('https://sharemechat.com');
    expect(m.IS_PROD_ENV).toBe(true);
    expect(m.isGoogleOAuthEnabled()).toBe(false); // ADR-058: oculto en PROD
  });

  test('host desconocido -> fallback a TEST', () => {
    const m = load('foo.example.com');
    expect(m.PRODUCT_ORIGIN).toBe('https://test.sharemechat.com');
    expect(m.IS_PROD_ENV).toBe(false);
  });
});
