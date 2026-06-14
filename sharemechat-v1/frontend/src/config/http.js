import { buildApiUrl } from './api';
import { getStoredLocale, getBrowserLocale } from '../i18n/localeUtils';
import { FALLBACK_LOCALE } from '../i18n/localeConfig';

let refreshPromise = null;

const isJsonResponse = (res) =>
  (res.headers.get('content-type') || '').includes('application/json');

// Paquete 10.A.3.pre: deteccion de ventana de mantenimiento del backend.
// Disparado por (a) 502/503/504 directos del backend antes de que CloudFront
// conmute al origen secundario, o (b) HTML (Content-Type text/html) en una
// respuesta a una llamada API, que es lo que CloudFront sirve desde el
// bucket sharemechat-maintenance via failover. Notifica a React por
// CustomEvent 'sharemechat:maintenance' en window para que
// MaintenanceProvider monte el overlay bloqueante.
//
// ADR-009 (PRODUCT_ACCESS_MODE): un 503 con header X-Product-Mode
// PRELAUNCH o CLOSED NO es mantenimiento — es el gate operacional cerrando
// el producto deliberadamente para usuarios no-allowlisted, y el frontend
// muestra <PreLaunchScreen/> en RequireRole. Si dispararamos overlay de
// mantenimiento aqui, taparia esa pantalla. MAINTENANCE explicito si
// dispara overlay (semantica alineada con el nombre del modo). 502/504 y
// 503 sin header de modo operacional siguen disparando overlay (es el
// fallo real de gateway/backend).
const isMaintenanceResponse = (res) => {
  if (!res) return false;
  if (res.status === 502 || res.status === 504) return true;
  if (res.status === 503) {
    const productMode = (res.headers.get('x-product-mode') || '').toUpperCase();
    if (productMode === 'PRELAUNCH' || productMode === 'CLOSED') return false;
    return true;
  }
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('text/html')) return true;
  return false;
};

const notifyMaintenance = (active) => {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('sharemechat:maintenance', {
      detail: { active: !!active }
    }));
  } catch {
    // No bloqueamos el flujo HTTP por un fallo del bus de eventos.
  }
};

const buildApiError = ({ status, message, data, text }) => {
  const err = new Error(message || `HTTP ${status}`);
  err.status = status;
  if (data !== undefined) err.data = data;
  if (text !== undefined) err.text = text;
  if (data && typeof data === 'object') {
    if (data.code !== undefined) err.code = data.code;
    if (data.error !== undefined) err.error = data.error;
    if (data.scope !== undefined) err.scope = data.scope;
    if (data.nextAction !== undefined) err.nextAction = data.nextAction;
    // Paquete 7 bloque 5: propagar campos estructurados de errores del
    // backend al objeto Error para que los callers (p. ej. el AIPanel del
    // CMS) puedan leer la lista detallada sin descenderla a `error.data`.
    // Retrocompatible: callers que solo lean `error.message` siguen
    // funcionando porque la propiedad principal del Error no cambia.
    if (Array.isArray(data.validationErrors)) {
      err.validationErrors = data.validationErrors;
    }
    if (data.context !== undefined) err.context = data.context;
    if (data.path !== undefined) err.path = data.path;
    if (data.timestamp !== undefined) err.timestamp = data.timestamp;
  }
  return err;
};

const readErrorPayload = async (res) => {
  if (isJsonResponse(res)) {
    const data = await res.json().catch(() => null);
    return {
      status: res.status,
      message: data?.message || `HTTP ${res.status}`,
      data,
    };
  }

  const text = await res.text().catch(() => null);
  return {
    status: res.status,
    message: text || `HTTP ${res.status}`,
    text,
  };
};

const getPreferredLocaleHeader = () => {

  const stored = getStoredLocale();
  if (stored) return stored;

  const browser = getBrowserLocale();
  if (browser) return browser;

  return FALLBACK_LOCALE;
};

const shouldSkipRefresh = (path) =>
  typeof path === 'string' && (path.startsWith('/auth/') || path.startsWith('/admin/auth/') || path === '/users/me');

const refreshSession = async () => {
  if (!refreshPromise) {
    refreshPromise = fetch(buildApiUrl('/auth/refresh'), {
      method: 'POST',
      credentials: 'include'
    })
      .then((res) => {
        if (!res.ok) {
          throw buildApiError({ status: res.status, message: `HTTP ${res.status}` });
        }
        return res;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

export const apiFetch = async (path, options = {}) => {
  const { headers = {}, _retry = false, ...restOptions } = options;

  const finalHeaders = { ...headers };

  if (!finalHeaders['Accept-Language'] && !finalHeaders['accept-language']) {
    finalHeaders['Accept-Language'] = getPreferredLocaleHeader();
  }

  const requestOptions = {
    credentials: 'include',
    ...restOptions,
    headers: finalHeaders
  };

  let res;

  try {
    res = await fetch(buildApiUrl(path), requestOptions);
  } catch (err) {
    throw err;
  }

  // Paquete 10.A.3.pre: si la respuesta indica ventana de mantenimiento
  // (5xx tipico de gateway o HTML del bucket de failover de CloudFront),
  // emitir el flag global y propagar como error normal. Sin reintento aqui:
  // el poll de MaintenanceProvider gestiona la recuperacion.
  if (isMaintenanceResponse(res)) {
    notifyMaintenance(true);
    const payload = await readErrorPayload(res);
    throw buildApiError(payload);
  }

  let previewError = null;

  if ((res.status === 401 || res.status === 403) && !_retry && !shouldSkipRefresh(path)) {
    previewError = await readErrorPayload(res.clone());

    const previewCode = String(previewError?.data?.code || '').toUpperCase();

    if (previewCode === 'EMAIL_NOT_VERIFIED') {
      // 403 EMAIL_NOT_VERIFIED: sin accion global; el error se propaga al
      // caller para que el componente que llamo muestre el aviso inline.
    } else if (previewCode === 'CLIENT_KYC_REQUIRED') {
      // 403 CLIENT_KYC_REQUIRED: defensa de ultimo recurso. Normalmente
      // el gate frontend (ensureClientKycApproved en los handlers de
      // pago) intercepta antes; si llega un 403 aqui significa que el
      // user evito el gate (URL directa, etc.). Redireccion directa, NO
      // bus de eventos: la respuesta al CLIENT_KYC_REQUIRED es siempre
      // unica (ir a /client-kyc), sin alternativas tipo "mas tarde".
      // Guarda el path actual como return URL para volver tras Didit.
      try {
        if (typeof window !== 'undefined') {
          const currentPath =
            (window.location && window.location.pathname ? window.location.pathname : '/client') +
            (window.location && window.location.search ? window.location.search : '');
          if (window.sessionStorage) {
            window.sessionStorage.setItem('client_kyc_return_url', currentPath);
          }
          window.location.href = '/client-kyc?return=' + encodeURIComponent(currentPath);
        }
      } catch {
        // Si el redirect falla, el error igualmente se propaga al caller.
      }
    } else {
      try {
        await refreshSession();
        return apiFetch(path, {
          ...restOptions,
          headers,
          _retry: true
        });
      } catch (refreshError) {
        // Dejamos caer el error original para preservar el flujo actual de logout.
      }
    }
  }

  if (!res.ok) {
    const finalError = previewError || await readErrorPayload(res);
    throw buildApiError(finalError);
  }

  return isJsonResponse(res)
    ? res.json()
    : res.text();
};
