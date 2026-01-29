// src/components/RequireRole.jsx
import React, { useEffect, useRef, useState } from 'react';
import { Redirect } from 'react-router-dom';
import Roles from '../constants/Roles';
import { useSession } from './SessionProvider';

const RequireRole = ({ role, roles, children }) => {
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

  if (!user) return <Redirect to="/login" />;

  const meRole = user?.role;

  const redirectToOwnDashboard = () => {
    if (meRole === Roles.CLIENT) return <Redirect to="/client" />;
    if (meRole === Roles.MODEL) return <Redirect to="/model" />;
    if (meRole === Roles.ADMIN) return <Redirect to="/dashboard-admin" />;
    return <Redirect to="/" />;
  };

  if (Array.isArray(roles) && roles.length > 0) {
    if (!meRole || !roles.includes(meRole)) return redirectToOwnDashboard();
    return children;
  }

  if (!meRole || meRole !== role) return redirectToOwnDashboard();

  return children;
};

export default RequireRole;
