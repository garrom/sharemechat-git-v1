// src/config/featureFlags.js
//
// Feature flags resueltos en runtime por hostname (no por build).
// Un único bundle se despliega a TEST/AUDIT/PROD; el comportamiento
// lo decide el host. Convivio con la convención ya establecida en
// runtimeEnv.js, que también discrimina por hostname.

const getHost = () => {
  if (typeof window === 'undefined' || !window.location) return '';
  return String(window.location.hostname || '').toLowerCase();
};

// ===========================================================
// Pre-launch overlay "COMING SOON" en la home pública anónima.
//
// Por qué existe: la home `/` es anónima y no consume el flag
// productAccessMode del backend (que solo viaja en /api/users/me
// para usuarios logueados). Mientras dure el periodo pre-launch
// queremos un overlay visible para visitantes.
//
// Reglas:
//   - TEST y AUDIT (entornos no productivos)    -> SIEMPRE visible.
//   - PROD (sharemechat.com / www.sharemechat.com) -> visible
//     mientras SHOW_IN_PROD = true. Cuando el modo operacional
//     pase a OPEN, basta poner SHOW_IN_PROD = false y redeployar
//     el SPA.
//
// AJUSTAR AQUI para apagarlo en PROD:
const SHOW_IN_PROD = true;
// ===========================================================

export const SHOW_PRELAUNCH_OVERLAY = (() => {
  const host = getHost();
  if (!host) return false;
  if (host.endsWith('test.sharemechat.com'))  return true;
  if (host.endsWith('audit.sharemechat.com')) return true;
  if (host === 'sharemechat.com' || host === 'www.sharemechat.com') {
    return SHOW_IN_PROD;
  }
  // localhost / preview / cualquier otro host -> visible por defecto
  // (no exponemos producto sin overlay en dev hasta el lanzamiento).
  return true;
})();
