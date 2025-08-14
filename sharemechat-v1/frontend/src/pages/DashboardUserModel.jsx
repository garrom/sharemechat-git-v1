import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  StyledContainer,
  StyledNavbar,
  StyledNavButton,
  StyledIconWrapper,
  StyledMainContent,
  StyledLeftColumn,
  StyledCenter,
  StyledRightColumn,
  StyledActionButton,
} from '../styles/ModelStyles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSignOutAlt, faUser } from '@fortawesome/free-solid-svg-icons';

const DashboardUserModel = () => {
  const history = useHistory();
  const token = localStorage.getItem('token');
  const [userName, setUserName] = useState('Modelo');
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (!token) {
      history.push('/login');
      return;
    }
    (async () => {
      try {
        const res = await fetch('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUserName(data.name || data.email || 'Modelo');
          setInfo(`Estado de verificación: ${data.verificationStatus || 'PENDING'}`);
        }
      } catch {}
    })();
  }, [token, history]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    history.push('/');
  };

  const handleProfile = () => {
    history.push('/perfil-model'); // tu ruta de perfil/modelo-docs
  };

  const handleUploadDocs = () => {
    // acción básica: redirigir a la pantalla de documentos (o abre modal si ya la tienes)
    history.push('/perfil-model'); // o '/model-documents'
  };

  return (
    <StyledContainer>
      <StyledNavbar>
        <span>Mi Logo</span>
        <div>
          <span className="me-3">Hola, {userName}</span>
          <StyledNavButton onClick={handleLogout}>
            <FontAwesomeIcon icon={faSignOutAlt} />
            <StyledIconWrapper>Salir</StyledIconWrapper>
          </StyledNavButton>
          <StyledNavButton onClick={handleProfile}>
            <FontAwesomeIcon icon={faUser} />
            <StyledIconWrapper>Perfil</StyledIconWrapper>
          </StyledNavButton>
        </div>
      </StyledNavbar>

      <StyledMainContent>
        <StyledLeftColumn />
        <StyledCenter>
          <h3>Completa tu verificación de Modelo</h3>
          {info && <p style={{ marginTop: 8, opacity: 0.8 }}>{info}</p>}

          <div style={{ marginTop: 16 }}>
            <StyledActionButton onClick={handleUploadDocs}>
              Actualizar / Subir documentos
            </StyledActionButton>
          </div>

          <p style={{ marginTop: 12, opacity: 0.75 }}>
            Una vez validados por el administrador, tu cuenta pasará a <strong>MODEL</strong>.
          </p>
        </StyledCenter>
        <StyledRightColumn />
      </StyledMainContent>
    </StyledContainer>
  );
};

export default DashboardUserModel;
