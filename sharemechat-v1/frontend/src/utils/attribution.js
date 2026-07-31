// src/utils/attribution.js
//
// Atribución de origen de registros — CAPA A (aditiva, solo frontend).
//
// Objetivo: registrar POR QUÉ CANAL llegó un visitante (first-touch) para
// medir en GA4 qué fuente trae registros. NO hay backend ni columna en BD
// (la capa B / acquisition_source queda aplazada a cuando haya revenue).
//
// Piezas:
//   1. captureFirstTouch(): al llegar con parámetros UTM, guarda la primera
//      fuente en una cookie propia (la primera gana; la navegación interna
//      posterior NO la sobrescribe). Expiración 90 días. Respeta consentimiento.
//   2. pushSignUp(): al confirmarse un alta, empuja el evento `sign_up` a
//      window.dataLayer con los UTM de la cookie. GTM (ya cargado en
//      public/index.html, contenedor GTM-T7BNJP4M) lo reenvía a GA4.
//      SIN PII (nada de email, nombre ni id personal).
//
// Consentimiento (GDPR/ePrivacy — plataforma adulta UE): tanto la escritura
// de la cookie como el evento de analítica respetan el consentimiento que ya
// gestiona CookieBanner (`localStorage['smc_cookie_consent']`). Solo el valor
// 'accepted' se trata como consentimiento de analítica; 'configured',
// 'rejected' y ausente => no se captura ni se emite.
//
// Contaminación TEST->PROD: el contenedor GTM es ÚNICO y compartido por
// TEST/AUDIT/PROD (deuda documentada: pre-mortem T3 + known-debt). Para no
// alimentar esa contaminación, el evento `sign_up` SOLO se empuja al
// dataLayer real (que GTM reenvía a GA4) cuando el host es PROD. En
// TEST/AUDIT/local el evento se construye igual pero se registra en consola
// y en window.__smcAttribution para verificación end-to-end SIN llegar a GA4.

const COOKIE_NAME = 'smc_attribution';
const COOKIE_MAX_AGE_DAYS = 90;
const CONSENT_KEY = 'smc_cookie_consent';

const PROD_HOSTS = new Set([
  'sharemechat.com',
  'www.sharemechat.com',
]);

// --- helpers de cookie (first-party, sin PII) -----------------------------

const readCookie = (name) => {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
};

const setCookie = (name, value, maxAgeSeconds) => {
  if (typeof document === 'undefined') return;
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  const isHttps =
    typeof window !== 'undefined' &&
    window.location &&
    window.location.protocol === 'https:';
  if (isHttps) parts.push('Secure');
  document.cookie = parts.join('; ');
};

// --- consentimiento -------------------------------------------------------

export const analyticsConsentGranted = () => {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'accepted';
  } catch (_) {
    return false;
  }
};

// --- entorno --------------------------------------------------------------

const isProdHost = () => {
  if (typeof window === 'undefined' || !window.location) return false;
  return PROD_HOSTS.has(window.location.hostname);
};

const currentEnvironment = () => {
  if (typeof window === 'undefined' || !window.location) return 'unknown';
  const host = window.location.hostname;
  if (PROD_HOSTS.has(host)) return 'prod';
  if (host.includes('audit.')) return 'audit';
  if (host.includes('test.')) return 'test';
  if (host === 'localhost' || host === '127.0.0.1') return 'local';
  return 'unknown';
};

// --- first-touch ----------------------------------------------------------

const readUtmFromUrl = () => {
  if (typeof window === 'undefined' || !window.location) return null;
  let params;
  try {
    params = new URLSearchParams(window.location.search);
  } catch (_) {
    return null;
  }
  const source = (params.get('utm_source') || '').trim();
  // Genérico: la fuente que venga gana; NO se hardcodea ningún canal.
  // Sin utm_source no consideramos que haya campaña (se tratará como
  // 'direct' en el momento del evento si no existe cookie previa).
  if (!source) return null;
  return {
    source,
    medium: (params.get('utm_medium') || '(not set)').trim() || '(not set)',
    campaign: (params.get('utm_campaign') || '(not set)').trim() || '(not set)',
  };
};

/**
 * Captura la primera fuente (first-touch) en cookie propia si:
 *  - hay consentimiento de analítica,
 *  - aún no existe la cookie (la primera fuente gana), y
 *  - la URL actual trae utm_source.
 * Idempotente: es seguro llamarla varias veces (al arrancar y tras aceptar
 * cookies). No sobrescribe una atribución ya guardada.
 */
export const captureFirstTouch = () => {
  try {
    if (!analyticsConsentGranted()) return;
    if (readCookie(COOKIE_NAME)) return; // la primera fuente gana
    const utm = readUtmFromUrl();
    if (!utm) return;
    const payload = {
      s: utm.source,
      m: utm.medium,
      c: utm.campaign,
      t: Date.now(),
    };
    setCookie(
      COOKIE_NAME,
      JSON.stringify(payload),
      COOKIE_MAX_AGE_DAYS * 24 * 60 * 60,
    );
  } catch (_) {
    // Nunca romper el arranque de la app por analítica.
  }
};

/**
 * Lee la atribución guardada. Si no hay cookie (o es ilegible), trata el
 * origen como 'direct'.
 */
export const readAttribution = () => {
  const raw = readCookie(COOKIE_NAME);
  if (raw) {
    try {
      const p = JSON.parse(raw);
      if (p && p.s) {
        return { source: p.s, medium: p.m || '(not set)', campaign: p.c || '(not set)' };
      }
    } catch (_) {
      // cookie corrupta -> tratar como direct
    }
  }
  return { source: 'direct', medium: '(none)', campaign: '(none)' };
};

// --- evento sign_up -------------------------------------------------------

/**
 * Empuja el evento `sign_up` a dataLayer con la atribución first-touch.
 * SIN PII. Respeta consentimiento. Solo llega a GA4 en PROD (env-gating por
 * host) para no contaminar la analítica compartida desde TEST/AUDIT.
 *
 * @param {Object} opts
 * @param {string} opts.userType  Tipo de alta ('client' | 'model' | 'master').
 */
export const pushSignUp = ({ userType } = {}) => {
  try {
    if (!analyticsConsentGranted()) return;
    const attr = readAttribution();
    const event = {
      event: 'sign_up',
      method: 'email',
      user_type: userType || 'unknown',
      utm_source: attr.source,
      utm_medium: attr.medium,
      utm_campaign: attr.campaign,
      environment: currentEnvironment(),
    };

    if (isProdHost()) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(event);
    } else {
      // No-PROD: no contaminar GA4. Registrar para verificación E2E.
      window.__smcAttribution = window.__smcAttribution || [];
      window.__smcAttribution.push(event);
      // eslint-disable-next-line no-console
      console.info('[attribution] sign_up (no-prod, NO enviado a GA4):', event);
    }
  } catch (_) {
    // Analítica nunca debe romper el flujo de registro.
  }
};
