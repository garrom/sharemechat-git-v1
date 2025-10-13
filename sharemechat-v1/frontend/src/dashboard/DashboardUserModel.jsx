import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  Shell, Navbar, NavbarRight, LogoutBtn,StyledBrand,
  Main, Card, PrimaryBtn, Muted
} from '../styles/DashboardUserCliModStyles';

const DashboardUserModel = () => {
  const history = useHistory();
  const token = localStorage.getItem('token');
  const [userName, setUserName] = useState('Modelo');
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (!token) { history.push('/'); return; }
    (async () => {
      try {
        const res = await fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 401) { localStorage.removeItem('token'); history.push('/'); return; }
        if (res.ok) {
          const data = await res.json();
          setUserName(data.nickname || data.name || data.email || 'Usuario');
          setInfo(`Estado de verificación: ${data.verificationStatus || 'PENDING'}`);
        }
      } catch {}
    })();
  }, [token, history]);

  const handleLogout = () => { localStorage.removeItem('token'); history.push('/'); };
  const handleUploadDocs = () => { history.push('/model-documents'); };

  return (
    <Shell>
      <Navbar $variant="model">
        <StyledBrand href="/" aria-label="SharemeChat" />
        <NavbarRight>
          <span>Hola, {userName}</span>
          <LogoutBtn onClick={handleLogout} title="Cerrar sesión">Salir</LogoutBtn>
        </NavbarRight>
      </Navbar>

      <Main>
        <Card>
          <h3>Completa tu verificación de Modelo</h3>
          {info && <Muted>{info}</Muted>}

          <div style={{ marginTop: 16 }}>
            <PrimaryBtn onClick={handleUploadDocs}>
              Actualizar / Subir documentos
            </PrimaryBtn>
          </div>

          <Muted style={{ marginTop: 12 }}>
            Una vez validados por el administrador, tu cuenta pasará a <strong>MODEL</strong>.
          </Muted>
        </Card>
      </Main>
    </Shell>
  );
};

export default DashboardUserModel;
