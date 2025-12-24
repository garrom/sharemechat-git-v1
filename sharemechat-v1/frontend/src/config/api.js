export const API_BASE = '/api';
export const WS_PATHS = { match: '/match', messages: '/messages' };

export const getToken = () => localStorage.getItem('token') || '';

export const buildApiUrl = (path) => `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;

export const wsBase = () => {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}`;
};

export const buildWsUrl = (path, params = {}) => {
  const base = wsBase();
  const p = path.startsWith('/') ? path : `/${path}`;
  const qs = new URLSearchParams(params).toString();
  return qs ? `${base}${p}?${qs}` : `${base}${p}`;
};
