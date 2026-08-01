// src/utils/attribution.js
//
// Atribución de origen de registros — CAPA A (aditiva, solo frontend).
//
// Objetivo: registrar POR QUÉ CANAL llegó un visitante (first-touch) para
// medir qué fuente trae registros.
//
// Piezas:
//   1. captureFirstTouch(): en la primera visita (con consentimiento) guarda
//      en una cookie propia el contexto first-touch: utm_source/medium/campaign
//      (si vienen), landing_path y referrer_host. La primera fuente de CAMPAÑA
//      gana; una visita directa/orgánica inicial guarda landing+referrer y se
//      "upgradea" con la utm de una campaña posterior sin perder el resto.
//      Expiración 90 días. Respeta consentimiento.
//   2. pushSignUp() [capa A]: al confirmarse un alta, empuja el evento GA4
//      `sign_up` a window.dataLayer con los UTM de la cookie. GTM
//      (GTM-T7BNJP4M) lo reenvía a GA4. SIN PII.
//   3. getAcquisitionPayload() [capa B, ADR-057]: devuelve el objeto que los
//      modales de registro adjuntan al POST para que el backend persista la
//      atribución first-touch atada al usuario (tabla user_acquisition). Sin
//      PII directa (solo canal de marketing).
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

// Ruta de aterrizaje (sin query, para no arrastrar PII de la URL).
const readLandingPath = () => {
  try {
    if (typeof window === 'undefined' || !window.location) return null;
    return window.location.pathname || null;
  } catch (_) {
    return null;
  }
};

// Host del referrer externo (sin path ni query). null si no hay referrer.
const readReferrerHost = () => {
  try {
    if (typeof document === 'undefined' || !document.referrer) return null;
    return new URL(document.referrer).host || null;
  } catch (_) {
    return null;
  }
};

const writeCookie = (payload) => {
  setCookie(COOKIE_NAME, JSON.stringify(payload), COOKIE_MAX_AGE_DAYS * 24 * 60 * 60);
};

/**
 * Captura el contexto first-touch en cookie propia (requiere consentimiento).
 *
 * - Primera visita: guarda utm (si hay), landing_path y referrer_host. Aunque
 *   sea directa/orgánica (sin utm) se guarda landing+referrer para la capa B.
 * - Visitas siguientes: NO sobrescribe. Única excepción, "upgrade" de campaña:
 *   si la cookie no tenía utm (first-touch directo) y ahora llega una utm, se
 *   añade la utm conservando landing/referrer/timestamp originales. Así el
 *   first-touch de CAMPAÑA gana sin perder el contexto inicial.
 *
 * Idempotente: seguro llamarla varias veces (al arrancar y al aceptar cookies).
 */
export const captureFirstTouch = () => {
  try {
    if (!analyticsConsentGranted()) return;
    const utm = readUtmFromUrl();
    const raw = readCookie(COOKIE_NAME);

    if (raw) {
      // Ya hay cookie: solo upgrade de utm si aún no tenía campaña.
      if (utm) {
        try {
          const p = JSON.parse(raw);
          if (p && !p.s) {
            p.s = utm.source;
            p.m = utm.medium;
            p.c = utm.campaign;
            writeCookie(p);
          }
        } catch (_) {
          // cookie corrupta: la dejamos como está.
        }
      }
      return;
    }

    // Primera visita con consentimiento: contexto first-touch completo.
    const payload = { t: Date.now() };
    const lp = readLandingPath();
    const rf = readReferrerHost();
    if (lp) payload.lp = lp;
    if (rf) payload.rf = rf;
    if (utm) {
      payload.s = utm.source;
      payload.m = utm.medium;
      payload.c = utm.campaign;
    }
    writeCookie(payload);
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

// --- capa B: payload de adquisición para el backend -----------------------

/**
 * Devuelve el objeto de atribución first-touch que los modales de registro
 * adjuntan al POST (campo `acquisition`) para que el backend lo persista en
 * user_acquisition (capa B, ADR-057). Respeta consentimiento. null si no hay
 * consentimiento o no hay cookie (el backend lo trata como "sin datos" y no
 * crea fila). Sin PII directa.
 */
export const getAcquisitionPayload = () => {
  try {
    if (!analyticsConsentGranted()) return null;
    const raw = readCookie(COOKIE_NAME);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p) return null;
    return {
      utmSource: p.s || null,
      utmMedium: p.m || null,
      utmCampaign: p.c || null,
      referrerHost: p.rf || null,
      landingPath: p.lp || null,
    };
  } catch (_) {
    return null;
  }
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
