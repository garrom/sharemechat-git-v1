import { buildApiUrl, getToken } from './api';

const isJsonResponse = (res) => (res.headers.get('content-type') || '').includes('application/json');

export const apiFetch = async (path, { auth = true, headers = {}, ...options } = {}) => {
  const token = getToken();
  const finalHeaders = { ...headers };

  if (auth && token) finalHeaders.Authorization = `Bearer ${token}`;

  const res = await fetch(buildApiUrl(path), { ...options, headers: finalHeaders });

  if (!res.ok) {
    const msg = isJsonResponse(res) ? JSON.stringify(await res.json()) : (await res.text());
    throw new Error(msg || `HTTP ${res.status}`);
  }

  return isJsonResponse(res) ? res.json() : res.text();
};
