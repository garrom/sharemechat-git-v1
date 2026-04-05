import React, { useEffect, useRef } from 'react';
import { Redirect } from 'react-router-dom';
import LoginModalContent from '../../components/LoginModalContent';
import { useSession } from '../../components/SessionProvider';
import { canAccessBackoffice } from '../../utils/backofficeAccess';
import { resolveHomeUrl } from '../../utils/runtimeSurface';

const AdminAccessPage = () => {
  const { user, loading, refresh } = useSession();
  const triedRef = useRef(false);

  useEffect(() => {
    if (triedRef.current) return;
    triedRef.current = true;
    refresh();
  }, [refresh]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f4f6fb' }}>
        <div style={{ color: '#495057', fontSize: 14 }}>Cargando acceso interno...</div>
      </div>
    );
  }

  if (user) {
    if (canAccessBackoffice(user)) {
      return <Redirect to={resolveHomeUrl(user)} />;
    }
    return <Redirect to="/unauthorized" />;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        background: 'linear-gradient(180deg, #eef3ff 0%, #f9fbff 100%)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#16324f' }}>SharemeChat Backoffice</div>
          <div style={{ marginTop: 8, color: '#5f6b7a', fontSize: 14 }}>
            Acceso interno para ADMIN y SUPPORT.
          </div>
        </div>

        <LoginModalContent initialView="login" />
      </div>
    </div>
  );
};

export default AdminAccessPage;
