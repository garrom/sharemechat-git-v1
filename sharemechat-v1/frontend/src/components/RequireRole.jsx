// /src/components/RequireRole.jsx
import React, { useEffect, useState } from 'react';
import { Redirect } from 'react-router-dom';

const RequireRole = ({ role, children }) => {
  const token = localStorage.getItem('token');
  const [me, setMe] = useState(null);   // null=cargando, false=no auth, objeto=ok

  useEffect(() => {
    let alive = true;

    if (!token) { setMe(false); return; }

    // importante: siempre leer el rol desde el servidor
    fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive) setMe(d || false); })
      .catch(() => { if (alive) setMe(false); });

    return () => { alive = false; };
  }, [token]);

  // 1) Cargando -> no parpadeos
  if (me === null) return null; // o un spinner

  // 2) No logueado -> a login (o a '/')
  if (me === false) return <Redirect to="/login" />;

  // 3) Logueado pero rol incorrecto -> redirige a su dashboard real
  if (!me?.role || me.role !== role) {
    // Envía al dashboard que le corresponde
    if (me.role === 'CLIENT') return <Redirect to="/client" />;
    if (me.role === 'MODEL')  return <Redirect to="/model" />;
    if (me.role === 'ADMIN')  return <Redirect to="/admin" />;
    // caso USER u otros
    return <Redirect to="/" />;
  }

  // 4) Autorizado
  return children;
};

export default RequireRole;
