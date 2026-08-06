import { useCallback } from 'react';
import i18n from '../i18n';
import { apiFetch } from '../config/http';
import { resolveHomeUrl } from '../utils/runtimeSurface';

/**
 * ADR-058: hook que encapsula el flujo "Sign in with Google" completo
 * — POST al backend, refresh de sesión, navegación al home resuelto por
 * rol, y mapeo exhaustivo de códigos de error a mensajes i18n.
 *
 * Puro y testeable: recibe todas sus dependencias por parámetro. El
 * componente contenedor (`LoginModalContent`, futuro perfil, etc.) es
 * responsable de proveer callbacks de estado (`setError`, `setStatus`,
 * `setLoading`) y de contexto (`refresh` desde SessionProvider,
 * `safeNavigate` desde useHistory, `onLoginSuccess`).
 *
 * Devuelve `handleGoogleAuth(idToken, intent)` que se pasa al botón
 * `GoogleSignInButton` como `onIdToken`.
 *
 * Códigos de respuesta mapeados (backend ADR-058):
 * - 200 → refresh + navigate + onLoginSuccess.
 * - 409 EMAIL_COLLISION_NEEDS_PASSWORD → mensaje específico.
 * - 404 NO_ACCOUNT_FOR_EMAIL → sugerir registro.
 * - 503 GOOGLE_AUTH_UNAVAILABLE → aviso indisponibilidad.
 * - 401 → token inválido (fallback backend).
 * - 403 → age gate no confirmado (denied).
 * - Cualquier otro → mensaje genérico.
 */
export default function useGoogleAuth({
  setError,
  setStatus,
  setLoading,
  refresh,
  safeNavigate,
  onLoginSuccess,
}) {
  return useCallback(async (idToken, intent) => {
    setError('');
    setStatus('');
    setLoading(true);
    try {
      await apiFetch('/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, intent, locale: i18n.language || 'es' }),
      });

      setStatus(i18n.t('auth.login.status.successRedirecting'));
      const u = await refresh();
      const target = resolveHomeUrl(u);
      safeNavigate(target);
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      const code = err && err.data && err.data.code;
      const backendMessage = err && err.data && err.data.message;
      const statusCode = Number(err && err.status);

      if (code === 'EMAIL_COLLISION_NEEDS_PASSWORD') {
        setError(backendMessage || i18n.t('auth.google.errors.emailCollision'));
      } else if (code === 'NO_ACCOUNT_FOR_EMAIL') {
        setError(backendMessage || i18n.t('auth.google.errors.noAccount'));
      } else if (code === 'ACCOUNT_INACTIVE') {
        setError(backendMessage || i18n.t('auth.google.errors.accountInactive'));
      } else if (code === 'GOOGLE_AUTH_UNAVAILABLE') {
        setError(i18n.t('auth.google.errors.unavailable'));
      } else if (statusCode === 401) {
        setError(i18n.t('auth.google.errors.invalidToken'));
      } else if (statusCode === 403) {
        setError(i18n.t('auth.login.errors.accessDenied'));
      } else {
        setError((err && err.message) || i18n.t('auth.login.errors.generic'));
      }
    } finally {
      setLoading(false);
    }
  }, [refresh, onLoginSuccess, safeNavigate, setError, setStatus, setLoading]);
}
