// Frente "Integracion Age Verification con add-balance/first" paso 2
// (2026-06-15). Helper comun para gatear en frontend los puntos de pago
// del producto cuando el cliente no tiene client_kyc_status=APPROVED.
//
// Patron: defensa en profundidad. El backend (commit 2d885cb) ya rechaza
// con 403 CLIENT_KYC_REQUIRED si se intenta /transactions/first o
// /transactions/add-balance sin KYC aprobado. Este helper evita el
// roundtrip 403 cuando el dato del user ya esta en memoria en el frontend
// (SessionProvider), redirigiendo directamente a /client-kyc con el
// return URL.

const CLIENT_KYC_APPROVED = 'APPROVED';
const RETURN_URL_KEY = 'client_kyc_return_url';
const DEFAULT_RETURN_PATH = '/client';

const isInternalPath = (p) =>
  typeof p === 'string' && p.length > 0 && p.startsWith('/') && !p.startsWith('//');

/**
 * Bloquea la accion si el user no tiene client_kyc_status=APPROVED y
 * redirige a /client-kyc?return=<returnPath>, guardando returnPath en
 * sessionStorage para que la pagina /client-kyc/processing (tras volver
 * de Didit) sepa donde devolver al usuario.
 *
 * @param {object} user      Usuario actual (de useSession).
 * @param {object} history   History de react-router (de useHistory()).
 * @param {string} returnPath  Path interno al que volver tras KYC OK.
 *                             Debe empezar por "/" (defensa open redirect).
 * @returns {boolean} true si APPROVED (continuar flujo), false si
 *                    redirigido (caller debe abortar).
 */
export const ensureClientKycApproved = (user, history, returnPath) => {
  if (user && user.clientKycStatus === CLIENT_KYC_APPROVED) {
    return true;
  }

  const safeReturn = isInternalPath(returnPath) ? returnPath : DEFAULT_RETURN_PATH;

  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(RETURN_URL_KEY, safeReturn);
    }
  } catch {
    // Si sessionStorage no esta disponible (modo privado, cuotas, etc.),
    // seguimos con la redireccion: la pagina /processing tiene fallback
    // a /client si no encuentra el valor.
  }

  history.push('/client-kyc?return=' + encodeURIComponent(safeReturn));
  return false;
};

export const CLIENT_KYC_RETURN_URL_KEY = RETURN_URL_KEY;
export const CLIENT_KYC_DEFAULT_RETURN_PATH = DEFAULT_RETURN_PATH;
export const isInternalReturnPath = isInternalPath;
