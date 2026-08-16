// ADR-059 Fase 4 — config/http.js `apiFetch`: la espina dorsal de TODAS las
// llamadas API del frontend. Cubre: éxito JSON/text + Accept-Language,
// detección de mantenimiento (5xx → evento global) vs gate PRELAUNCH,
// refresh transparente 401→retry, y los gates EMAIL_NOT_VERIFIED /
// CLIENT_KYC_REQUIRED / skip-refresh en /auth. Se mockea fetch y el entorno.

import { apiFetch } from './http';

jest.mock('../i18n/localeUtils', () => ({
  getStoredLocale: () => 'es',
  getBrowserLocale: () => 'es',
}));
jest.mock('../i18n/localeConfig', () => ({ FALLBACK_LOCALE: 'es' }));

// Response-like mínimo. clone() devuelve el mismo objeto (json/text son
// funciones idempotentes) — suficiente para el preview de apiFetch.
function resp({ status = 200, json, text, contentType, productMode }) {
  const r = {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get: (k) => {
        const key = String(k).toLowerCase();
        if (key === 'content-type') return contentType ?? (json !== undefined ? 'application/json' : 'text/plain');
        if (key === 'x-product-mode') return productMode ?? '';
        return null;
      },
    },
    json: async () => json,
    text: async () => text ?? '',
    clone() { return r; },
  };
  return r;
}

let dispatchSpy;
let originalLocationDescriptor;

beforeEach(() => {
  global.fetch = jest.fn();
  dispatchSpy = jest.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
  window.sessionStorage.clear();
  originalLocationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
});

afterEach(() => {
  jest.restoreAllMocks();
  if (originalLocationDescriptor) Object.defineProperty(window, 'location', originalLocationDescriptor);
});

describe('apiFetch — happy path', () => {
  test('200 JSON -> devuelve el objeto parseado; añade Accept-Language y credentials', async () => {
    fetch.mockResolvedValue(resp({ status: 200, json: { a: 1 } }));
    const data = await apiFetch('/users/me');
    expect(data).toEqual({ a: 1 });
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe('/api/users/me'); // buildApiUrl prefija /api
    expect(opts.credentials).toBe('include');
    expect(opts.headers['Accept-Language']).toBe('es');
  });

  test('200 texto plano -> devuelve el texto', async () => {
    fetch.mockResolvedValue(resp({ status: 200, text: 'ok', contentType: 'text/plain' }));
    expect(await apiFetch('/ping')).toBe('ok');
  });
});

describe('apiFetch — mantenimiento (ADR-009 / failover)', () => {
  test('503 sin X-Product-Mode -> emite evento maintenance y lanza', async () => {
    fetch.mockResolvedValue(resp({ status: 503, json: { message: 'down' } }));
    const err = await apiFetch('/clients/me').catch((e) => e);
    expect(err.status).toBe(503);
    const ev = dispatchSpy.mock.calls.find((c) => c[0]?.type === 'sharemechat:maintenance')?.[0];
    expect(ev).toBeTruthy();
    expect(ev.detail.active).toBe(true);
  });

  test('503 con X-Product-Mode PRELAUNCH -> NO es mantenimiento (gate de negocio)', async () => {
    fetch.mockResolvedValue(resp({ status: 503, productMode: 'PRELAUNCH', json: { code: 'PRODUCT_UNAVAILABLE' } }));
    const err = await apiFetch('/clients/me').catch((e) => e);
    expect(err.status).toBe(503);
    // No debe dispararse el overlay de mantenimiento para el gate PRELAUNCH.
    const maint = dispatchSpy.mock.calls.some((c) => c[0]?.type === 'sharemechat:maintenance');
    expect(maint).toBe(false);
  });
});

describe('apiFetch — refresh transparente 401', () => {
  test('401 -> refresh OK -> reintenta y devuelve datos', async () => {
    fetch
      .mockResolvedValueOnce(resp({ status: 401, json: {} }))          // 1ª: /api/x
      .mockResolvedValueOnce(resp({ status: 200, json: {} }))          // 2ª: /api/auth/refresh
      .mockResolvedValueOnce(resp({ status: 200, json: { ok: true } })); // 3ª: retry /api/x
    const data = await apiFetch('/clients/me');
    expect(data).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[1][0]).toBe('/api/auth/refresh');
  });

  test('401 -> refresh falla -> propaga el error original (sin bucle)', async () => {
    fetch
      .mockResolvedValueOnce(resp({ status: 401, json: { message: 'no auth' } })) // /api/x
      .mockResolvedValueOnce(resp({ status: 401, json: {} }));                    // refresh 401 -> throw
    const err = await apiFetch('/clients/me').catch((e) => e);
    expect(err.status).toBe(401);
    expect(fetch).toHaveBeenCalledTimes(2); // no reintenta
  });

  test('401 en /auth/login -> NO intenta refresh (shouldSkipRefresh)', async () => {
    fetch.mockResolvedValue(resp({ status: 401, json: { message: 'bad creds' } }));
    const err = await apiFetch('/auth/login', { method: 'POST' }).catch((e) => e);
    expect(err.status).toBe(401);
    expect(fetch).toHaveBeenCalledTimes(1); // sin llamada a /auth/refresh
  });
});

describe('apiFetch — gates especiales', () => {
  test('403 EMAIL_NOT_VERIFIED -> NO refresca, propaga el error con su code', async () => {
    fetch.mockResolvedValue(resp({ status: 403, json: { code: 'EMAIL_NOT_VERIFIED', message: 'verifica' } }));
    const err = await apiFetch('/clients/me').catch((e) => e);
    expect(err.status).toBe(403);
    expect(err.code).toBe('EMAIL_NOT_VERIFIED');
    expect(fetch).toHaveBeenCalledTimes(1); // no refresh
  });

  test('403 CLIENT_KYC_REQUIRED -> redirige a /client-kyc con return + guarda en sessionStorage', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '/client', search: '', href: '' },
    });
    fetch.mockResolvedValue(resp({ status: 403, json: { code: 'CLIENT_KYC_REQUIRED' } }));

    const err = await apiFetch('/transactions/first', { method: 'POST' }).catch((e) => e);

    expect(window.location.href).toBe('/client-kyc?return=' + encodeURIComponent('/client'));
    expect(window.sessionStorage.getItem('client_kyc_return_url')).toBe('/client');
    expect(err.status).toBe(403); // el error igualmente se propaga
    expect(fetch).toHaveBeenCalledTimes(1); // no refresh
  });
});

describe('apiFetch — error genérico', () => {
  test('400 con data -> lanza error con status y code', async () => {
    fetch.mockResolvedValue(resp({ status: 400, json: { code: 'BAD_REQUEST', message: 'malformado' } }));
    const err = await apiFetch('/billing/nowpayments/checkout', { method: 'POST' }).catch((e) => e);
    expect(err.status).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.message).toBe('malformado');
  });
});
