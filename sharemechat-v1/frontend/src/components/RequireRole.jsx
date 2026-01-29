// src/components/RequireRole.jsx
import React from 'react';
import { Redirect } from 'react-router-dom';
import Roles from '../constants/Roles';
import { useSession } from './SessionProvider';

const RequireRole = ({ role, roles, children }) => {
  const { user, loading } = useSession();

  // Mientras SessionProvider hace /api/users/me
  if (loading) return null;

  // No autenticado => login
  if (!user) return <Redirect to="/login" />;

  const meRole = user?.role;

  const redirectToOwnDashboard = () => {
    if (meRole === Roles.CLIENT) return <Redirect to="/client" />;
    if (meRole === Roles.MODEL) return <Redirect to="/model" />;
    if (meRole === Roles.ADMIN) return <Redirect to="/dashboard-admin" />;
    return <Redirect to="/" />;
  };

  // Caso 1: roles (array)
  if (Array.isArray(roles) && roles.length > 0) {
    if (!meRole || !roles.includes(meRole)) {
      return redirectToOwnDashboard();
    }
    return children;
  }

  // Caso 2: role (string)
  if (!meRole || meRole !== role) {
    return redirectToOwnDashboard();
  }

  return children;
};

export default RequireRole;