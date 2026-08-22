// Observabilidad #4 — reporte casero de errores del navegador: envío
// fire-and-forget (sendBeacon con fallback a fetch), dedup, throttle, y handlers
// globales (window 'error' / 'unhandledrejection').

import {
  reportClientError,
  installGlobalErrorHandlers,
  __resetForTests,
} from './clientErrorReporter';

const ENDPOINT = '/api/observability/client-error';

beforeEach(() => {
  __resetForTests();
  Object.defineProperty(window.navigator, 'sendBeacon', {
    value: jest.fn(() => true),
    configurable: true,
    writable: true,
  });
  global.fetch = jest.fn(() => Promise.resolve({ ok: true }));
});

test('envía por sendBeacon al endpoint; sin fallback a fetch si va bien', () => {
  reportClientError({ message: 'boom' });
  expect(window.navigator.sendBeacon).toHaveBeenCalledTimes(1);
  expect(window.navigator.sendBeacon.mock.calls[0][0]).toBe(ENDPOINT);
  expect(global.fetch).not.toHaveBeenCalled();
});

test('si sendBeacon falla, cae a fetch con el payload (message/url/userAgent)', () => {
  window.navigator.sendBeacon = jest.fn(() => false);
  reportClientError({ message: 'boom', source: 'App.jsx:1' });
  expect(global.fetch).toHaveBeenCalledTimes(1);
  const [url, opts] = global.fetch.mock.calls[0];
  expect(url).toBe(ENDPOINT);
  const body = JSON.parse(opts.body);
  expect(body.message).toBe('boom');
  expect(body.source).toBe('App.jsx:1');
  expect(typeof body.url).toBe('string');
  expect(typeof body.userAgent).toBe('string');
});

test('dedup: el mismo error (message+source) solo se envía una vez', () => {
  reportClientError({ message: 'dup', source: 's' });
  reportClientError({ message: 'dup', source: 's' });
  expect(window.navigator.sendBeacon).toHaveBeenCalledTimes(1);
});

test('throttle: como mucho 20 reportes por carga', () => {
  for (let i = 0; i < 30; i += 1) reportClientError({ message: `e${i}` });
  expect(window.navigator.sendBeacon).toHaveBeenCalledTimes(20);
});

test('installGlobalErrorHandlers captura window "error"', () => {
  installGlobalErrorHandlers();
  window.dispatchEvent(new ErrorEvent('error', { message: 'x', filename: 'a.js', lineno: 3 }));
  expect(window.navigator.sendBeacon).toHaveBeenCalled();
});
