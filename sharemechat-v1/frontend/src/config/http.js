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
  }
  return err;
};

const getPreferredLocaleHeader = () => {

  const stored = getStoredLocale();
  if (stored) return stored;

  const browser = getBrowserLocale();
  if (browser) return browser;

  return FALLBACK_LOCALE;
};

const shouldSkipRefresh = (path) =>
  typeof path === 'string' && (path.startsWith('/auth/') || path === '/users/me');

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

  if ((res.status === 401 || res.status === 403) && !_retry && !shouldSkipRefresh(path)) {
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

  if (!res.ok) {

    if (isJsonResponse(res)) {
      const data = await res.json().catch(() => null);
      const message = data?.message || `HTTP ${res.status}`;
      throw buildApiError({ status: res.status, message, data });
    }

    const text = await res.text().catch(() => null);
    throw buildApiError({ status: res.status, message: text || `HTTP ${res.status}`, text });
  }

  return isJsonResponse(res)
    ? res.json()
    : res.text();
};
