import { buildApiUrl } from './api';

const isJsonResponse = (res) => (res.headers.get('content-type') || '').includes('application/json');

export const apiFetch = async (path, { headers = {}, ...options } = {}) => {
  const finalHeaders = { ...headers };

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

  return isJsonResponse(res) ? res.json() : res.text();
};
