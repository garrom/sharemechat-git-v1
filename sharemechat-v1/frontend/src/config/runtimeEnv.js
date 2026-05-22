// src/config/runtimeEnv.js
//
// Paquete 10.A.5: detecta el entorno (TEST/AUDIT/PROD) en runtime a partir
// de window.location.hostname y resuelve los origins de las superficies
// hermanas (producto, admin) y la base URL del CDN de assets.
//
// El build del frontend es identico para todos los entornos (un solo
// `npm run build:product` genera el bundle que se despliega a los buckets
// frontend de TEST y AUDIT, y eventualmente a PROD). Esta detection-by-host
// evita necesitar builds separados por entorno.
//
// Cuando se anada un dominio nuevo (PROD, www, otro subdominio), basta con
// extender ENV_MAP. Si el host actual no esta mapeado, se cae a DEFAULT_ENV
// (TEST) para no romper.

const TEST_ORIGINS = {
  product: 'https://test.sharemechat.com',
  admin:   'https://admin.test.sharemechat.com',
  assets:  'https://assets.test.sharemechat.com',
};

const AUDIT_ORIGINS = {
  product: 'https://audit.sharemechat.com',
  admin:   'https://admin.audit.sharemechat.com',
  assets:  'https://assets.audit.sharemechat.com',
};

const PROD_ORIGINS = {
  product: 'https://sharemechat.com',
  admin:   'https://admin.sharemechat.com',
  assets:  'https://assets.sharemechat.com',
};

const ENV_MAP = {
  // TEST
  'test.sharemechat.com':       TEST_ORIGINS,
  'www.test.sharemechat.com':   TEST_ORIGINS,
  'admin.test.sharemechat.com': TEST_ORIGINS,
  // AUDIT
  'audit.sharemechat.com':       AUDIT_ORIGINS,
  'www.audit.sharemechat.com':   AUDIT_ORIGINS,
  'admin.audit.sharemechat.com': AUDIT_ORIGINS,
  // PROD
  'sharemechat.com':       PROD_ORIGINS,
  'www.sharemechat.com':   PROD_ORIGINS,
  'admin.sharemechat.com': PROD_ORIGINS,
};

const DEFAULT_ENV = TEST_ORIGINS;

const resolveOrigins = () => {
  if (typeof window === 'undefined' || !window.location) return DEFAULT_ENV;
  const host = window.location.hostname;
  return ENV_MAP[host] || DEFAULT_ENV;
};

const resolved = resolveOrigins();

export const PRODUCT_ORIGIN = resolved.product;
export const ADMIN_ORIGIN = resolved.admin;
export const ASSETS_BASE = resolved.assets;
