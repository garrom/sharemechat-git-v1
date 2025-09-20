import React, { useEffect, useState } from 'react';
import { Redirect } from 'react-router-dom';
import Roles from '../constants/Roles';

const RequireRole = ({ role, roles, children }) => {
  const token = localStorage.getItem('token');
  const [me, setMe] = useState(null); // null=cargando, false=no auth, objeto=ok

  useEffect(() => {
    let alive = true;
    if (!token) { setMe(false); return; }

    fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive) setMe(d || false); })
      .catch(() => { if (alive) setMe(false); });

    return () => { alive = false; };
  }, [token]);

  if (me === null) return null;          // spinner opcional
  if (me === false) return <Redirect to="/login" />;

  // Si se pasa 'roles' (array), comprobar membresía
  if (Array.isArray(roles) && roles.length > 0) {
    if (!me?.role || !roles.includes(me.role)) {
      if (me.role === Roles.CLIENT) return <Redirect to="/client" />;
      if (me.role === Roles.MODEL)  return <Redirect to="/model" />;
      if (me.role === Roles.ADMIN)  return <Redirect to="/dashboard-admin" />;
      return <Redirect to="/" />;
    }
    return children;
  }

  if (!me?.role || me.role !== role) {
    // Envía al dashboard que le corresponde
    if (me.role === Roles.CLIENT) return <Redirect to="/client" />;
    if (me.role === Roles.MODEL)  return <Redirect to="/model" />;
    if (me.role === Roles.ADMIN)  return <Redirect to="/dashboard-admin" />;
    return <Redirect to="/" />;
  }

  return children;
};

export default RequireRole;
