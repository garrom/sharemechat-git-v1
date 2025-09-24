// src/consent/consentClient.js

export const TERMS_VERSION = process.env.REACT_APP_TERMS_VERSION || 'v1';

const ageKey = (v) => `age_ok_${v}`;
const termsKey = (v) => `terms_ok_${v}`;

const readCookie = (name) => {
  const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
};

const setCookie = (name, value, maxAgeSeconds) => {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  const isHttps = typeof window !== 'undefined' && window.location && window.location.protocol === 'https:';
  if (isHttps) parts.push('Secure');
  document.cookie = parts.join('; ');
};

export const ensureConsentId = () => {
  let id = readCookie('consent_id');
  if (!id) {
    const hasUUID = typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID;
    id = hasUUID ? window.crypto.randomUUID() : 'cid-' + Math.random().toString(36).slice(2) + Date.now();
    setCookie('consent_id', id, 60 * 60 * 24 * 365);
  }
  return id;
};

export const setLocalAgeOk = (version = TERMS_VERSION) => {
  localStorage.setItem(ageKey(version), 'true');
};
export const setLocalTermsOk = (version = TERMS_VERSION) => {
  localStorage.setItem(termsKey(version), 'true');
};
export const isLocalAgeOk = (version = TERMS_VERSION) =>
  localStorage.getItem(ageKey(version)) === 'true';
export const isLocalTermsOk = (version = TERMS_VERSION) =>
  localStorage.getItem(termsKey(version)) === 'true';

const postBeacon = (url, bodyObj) => {
  const body = JSON.stringify(bodyObj || {});
  const blob = new Blob([body], { type: 'application/json' });
  try {
    if (navigator.sendBeacon && navigator.sendBeacon(url, blob)) return Promise.resolve(true);
  } catch (_) {}
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
    credentials: 'include',
  }).then(() => true).catch(() => false);
};

export const logAgeGateAccept = (path) => {
  ensureConsentId();
  const safePath =
    path ||
    ((typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '/');
  return postBeacon('/api/consent/age-gate', { path: safePath });
};

export const logTermsAccept = (version = TERMS_VERSION, path) => {
  ensureConsentId();
  const url = `/api/consent/terms?v=${encodeURIComponent(version)}`;
  const safePath =
    path ||
    ((typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '/');
  return postBeacon(url, { path: safePath });
};
