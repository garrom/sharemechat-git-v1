// Pre-launch: SHOW_PRELAUNCH_OVERLAY se resuelve por hostname en tiempo de import
// (IIFE, un solo bundle para TEST/AUDIT/PROD). Patrón resetModules + override de
// hostname + require (mismo que runtimeEnv.test.js).

describe('SHOW_PRELAUNCH_OVERLAY por hostname', () => {
  let originalLocation;

  beforeAll(() => {
    originalLocation = Object.getOwnPropertyDescriptor(window, 'location');
  });
  afterAll(() => {
    if (originalLocation) Object.defineProperty(window, 'location', originalLocation);
  });

  const flagFor = (hostname) => {
    jest.resetModules();
    delete window.location;
    window.location = { hostname };
    return require('./featureFlags').SHOW_PRELAUNCH_OVERLAY;
  };

  test('TEST y AUDIT -> siempre visible', () => {
    expect(flagFor('test.sharemechat.com')).toBe(true);
    expect(flagFor('audit.sharemechat.com')).toBe(true);
  });

  test('PROD -> visible mientras SHOW_IN_PROD (hoy true)', () => {
    expect(flagFor('sharemechat.com')).toBe(true);
    expect(flagFor('www.sharemechat.com')).toBe(true);
  });

  test('localhost / otros hosts -> visible por defecto (no exponer sin overlay)', () => {
    expect(flagFor('localhost')).toBe(true);
    expect(flagFor('preview.example.com')).toBe(true);
  });

  test('host vacío -> false', () => {
    expect(flagFor('')).toBe(false);
  });
});
