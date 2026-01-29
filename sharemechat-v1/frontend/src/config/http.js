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
    const msg = isJsonResponse(res) ? JSON.stringify(await res.json()) : (await res.text());
    throw new Error(msg || `HTTP ${res.status}`);
  }

  return isJsonResponse(res) ? res.json() : res.text();
};