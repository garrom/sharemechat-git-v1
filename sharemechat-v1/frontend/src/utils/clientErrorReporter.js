// Observabilidad #4 (2026-08-22) — reporte casero de errores del navegador.
// Captura errores JS no controlados y rechazos de promesa, y los manda al backend
// (POST /api/observability/client-error) fire-and-forget. Sin Sentry: el error
// queda en el log central del backend (trazable por requestId). Con throttle +
// dedup para no inundar ni al navegador ni a nuestros logs.

const ENDPOINT = '/api/observability/client-error';
const MAX_REPORTS_PER_LOAD = 20;

let sent = 0;
const seen = new Set();

function send(payload) {
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
  } catch (e) { /* cae al fetch */ }
  try {
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: 'include',
    }).catch(() => {});
  } catch (e) { /* no-op: reportar un error nunca debe romper la app */ }
}

export function reportClientError({ message, source, stack } = {}) {
  try {
    const msg = String(message || 'unknown');
    const signature = `${msg}|${source || ''}`;
    if (sent >= MAX_REPORTS_PER_LOAD || seen.has(signature)) return;
    seen.add(signature);
    sent += 1;

    send({
      message: msg.slice(0, 1000),
      source: source ? String(source).slice(0, 300) : '',
      stack: stack ? String(stack).slice(0, 8000) : '',
      url: (typeof window !== 'undefined' && window.location) ? window.location.href : '',
      userAgent: (typeof navigator !== 'undefined') ? navigator.userAgent : '',
    });
  } catch (e) { /* no-op */ }
}

let installed = false;

export function installGlobalErrorHandlers() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (e) => {
    // Solo errores de script (los de carga de recursos no traen message).
    if (!e || !e.message) return;
    reportClientError({
      message: e.message,
      source: e.filename ? `${e.filename}:${e.lineno || 0}:${e.colno || 0}` : '',
      stack: (e.error && e.error.stack) ? e.error.stack : '',
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e && e.reason;
    reportClientError({
      message: (reason && reason.message) ? reason.message : String(reason),
      source: 'unhandledrejection',
      stack: (reason && reason.stack) ? reason.stack : '',
    });
  });
}

// Solo para tests: reinicia el estado de throttle/dedup.
export function __resetForTests() {
  sent = 0;
  seen.clear();
  installed = false;
}
