// src/components/RequireRole.jsx
import React, { useEffect, useRef, useState } from 'react';
import { Redirect } from 'react-router-dom';
import { useSession } from './SessionProvider';
import { hasBackofficeRole } from '../utils/backofficeAccess';
import { isAbsoluteUrl, resolveHomeUrl } from '../utils/runtimeSurface';

const RequireRole = ({ role, roles, backofficeRoles, children }) => {
  const { user, loading, refresh } = useSession();
  const triedRef = useRef(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (loading) return;

    // Si no hay user, reintentamos 1 vez (por si hubo fallo temporal)
    if (!user && !triedRef.current) {
      triedRef.current = true;
      setRetrying(true);
      Promise.resolve(refresh())
        .finally(() => setRetrying(false));
    }
  }, [loading, user, refresh]);

  if (loading || retrying) return null;

  if (!user) {
    if (!triedRef.current) return null;
    return <Redirect to="/login" />;
  }

  const meRole = user?.role;

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

  if (Array.isArray(roles) && roles.length > 0) {
    if (!meRole || !roles.includes(meRole)) return redirectToOwnDashboard();
    return children;
  }

  if (!meRole || meRole !== role) return redirectToOwnDashboard();

  return children;
};

export default RequireRole;
