import { buildApiUrl } from './api';
import { getStoredLocale, getBrowserLocale } from '../i18n/localeUtils';
import { FALLBACK_LOCALE } from '../i18n/localeConfig';

const isJsonResponse = (res) =>
  (res.headers.get('content-type') || '').includes('application/json');

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
      throw new Error(message);
    }

    const text = await res.text().catch(() => null);
    throw new Error(text || `HTTP ${res.status}`);
  }

  return isJsonResponse(res)
    ? res.json()
    : res.text();
};
