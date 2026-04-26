// src/components/RequireRole.jsx
import React from 'react';
import { Redirect } from 'react-router-dom';
import { useSession } from './SessionProvider';
import { hasBackofficeRole } from '../utils/backofficeAccess';
import { isAbsoluteUrl, resolveHomeUrl } from '../utils/runtimeSurface';

const normalizeUserTypes = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((value) => String(value || '').trim().toUpperCase())
    .filter(Boolean);
};

const RequireRole = ({ role, roles, backofficeRoles, allowedUserTypes, children }) => {
  const { user, loading } = useSession();

  if (loading && !user) return null;

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
