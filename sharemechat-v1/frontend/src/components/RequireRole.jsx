// src/components/RequireRole.jsx
import React from 'react';
import { Redirect } from 'react-router-dom';
import { useSession } from './SessionProvider';
import { hasBackofficeRole } from '../utils/backofficeAccess';
import { isAbsoluteUrl, resolveHomeUrl } from '../utils/runtimeSurface';
import PreLaunchScreen from './PreLaunchScreen';

// Product Operational Mode (ADR-009): cuando el backend nos informa que
// el modo de acceso esta en PRELAUNCH y el usuario logueado no esta en
// la allowlist de bypass, sustituimos cualquier ruta de producto por
// la pantalla pre-launch. El bloqueo real de endpoints sensibles vive
// en el backend (ProductOperationalModeFilter); esta puerta es la
// experiencia visible. Las rutas backoffice (con backofficeRoles) NO
// pasan por esta puerta: el admin sigue accediendo a su panel para
// poder operar el lanzamiento.
const isPreLaunchActive = (user) => {
  if (!user) return false;
  const mode = String(user.productAccessMode || '').toUpperCase();
  if (mode !== 'PRELAUNCH') return false;
  return user.allowlisted !== true;
};

const normalizeUserTypes = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((value) => String(value || '').trim().toUpperCase())
    .filter(Boolean);
};

const RequireRole = ({ role, roles, backofficeRoles, allowedUserTypes, children }) => {
  const { user, loading } = useSession();

  // ADR-009 PRELAUNCH gate hardening: la puerta empieza CERRADA por
  // defecto y solo abre cuando el backend ha confirmado el estado.
  //
  // Causa del flicker visible que esta politica resuelve:
  //  - React 17 (ReactDOM.render, no createRoot) NO batchea los
  //    setStates async post-await. En SessionProvider.loadMe() hay un
  //    `setUser(data); await applyLocale(data); setLoading(false);` que
  //    en React 17 produce DOS renders distintos: primero (user=data,
  //    loading=true), luego (user=data, loading=false).
  //  - El cambio de idioma del LocaleSwitcher hace
  //    window.location.assign(newPath) por restriccion del basename
  //    del Router (`/en` vs `/`): full reload. Tras la recarga, el
  //    arranque vuelve a pasar por el mismo render-intermedio.
  //  - El hard-refresh tambien lo dispara: el useEffect del
  //    SessionProvider sobre location.pathname puede correr dos veces
  //    durante el mount y dejar transitoriamente un user parcialmente
  //    enriquecido.
  //
  // Politica que aplica esta guarda:
  //  1) Mientras loading=true, no renderizar children NUNCA (aunque
  //     ya tengamos un user previo): podria estar a medio refrescar.
  //  2) Sin user → /login (estado clasico no autenticado).
  //  3) Con user pero `productAccessMode` vacio/undefined → tratar
  //     como "modo desconocido" y no abrir la puerta (cubre cache
  //     viejo del navegador con response pre-enriquecimiento, race
  //     entre fetches concurrentes, etc.).
  //  4) Solo cuando user y mode estan confirmados, decidir
  //     PreLaunchScreen vs producto real.
  //
  // Coste: un parpadeo "pantalla blanca -> PreLaunchScreen" en el
  // primer render tras recarga (mientras el fetch /me esta en vuelo).
  // Es admisible: el flicker grave era "ModelDocuments real ->
  // PreLaunchScreen". Pasamos de "ver pagina prohibida" a "ver vacio".

  if (loading) return null;

  if (!user) {
    return <Redirect to="/login" />;
  }

  const meRole = user?.role;
  const meUserType = String(user?.userType || '').trim().toUpperCase();
  const normalizedAllowedUserTypes = normalizeUserTypes(allowedUserTypes);

  const redirectToOwnDashboard = () => {
    const target = resolveHomeUrl(user);
    if (isAbsoluteUrl(target) && typeof window !== 'undefined') {
      window.location.replace(target);
      return null;
    }
    return <Redirect to={target} />;
  };

  if (Array.isArray(backofficeRoles) && backofficeRoles.length > 0) {
    const allowed = backofficeRoles.some((code) => hasBackofficeRole(user, code));
    if (!allowed) return redirectToOwnDashboard();
    return children;
  }

  // Estado desconocido del modo operacional: no renderizamos children
  // hasta que el backend lo confirme. Equivalente a "loading aplicado a
  // ADR-009": defensa en profundidad por si algun setState parcial deja
  // user sin productAccessMode.
  const mode = String(user.productAccessMode || '').toUpperCase();
  if (!mode) return null;

  // PRELAUNCH gate (ADR-009). El backend ya rechaza endpoints sensibles
  // con 503 para no-allowlisted; este return es solo la pantalla visible.
  if (isPreLaunchActive(user)) {
    return <PreLaunchScreen />;
  }

  if (normalizedAllowedUserTypes.length > 0 && !normalizedAllowedUserTypes.includes(meUserType)) {
    return <Redirect to="/unauthorized" />;
  }

  if (Array.isArray(roles) && roles.length > 0) {
    if (!meRole || !roles.includes(meRole)) return redirectToOwnDashboard();
    return children;
  }

  if (!meRole || meRole !== role) return redirectToOwnDashboard();

  return children;
};

export default RequireRole;
