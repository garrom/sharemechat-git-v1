import { buildApiUrl } from './api';
import { getStoredLocale, getBrowserLocale } from '../i18n/localeUtils';
import { FALLBACK_LOCALE } from '../i18n/localeConfig';

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

export const apiFetch = async (path, { headers = {}, ...options } = {}) => {

  const finalHeaders = { ...headers };

  if (!finalHeaders['Accept-Language'] && !finalHeaders['accept-language']) {
    finalHeaders['Accept-Language'] = getPreferredLocaleHeader();
  }

  const res = await fetch(buildApiUrl(path), {
    credentials: 'include',
    ...options,
    headers: finalHeaders
  });

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
