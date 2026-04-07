import { buildApiUrl } from './api';
import { getStoredLocale, getBrowserLocale } from '../i18n/localeUtils';
import { FALLBACK_LOCALE } from '../i18n/localeConfig';

let refreshPromise = null;

const isJsonResponse = (res) =>
  (res.headers.get('content-type') || '').includes('application/json');

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

  let previewError = null;

  if ((res.status === 401 || res.status === 403) && !_retry && !shouldSkipRefresh(path)) {
    previewError = await readErrorPayload(res.clone());

    if (String(previewError?.data?.code || '').toUpperCase() !== 'EMAIL_NOT_VERIFIED') {
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
