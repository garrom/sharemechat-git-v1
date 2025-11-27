// src/pages/dashboard/DashboardUserModel.jsx
import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';

// Layout base (mismo que DashboardUserClient)
import {
  StyledContainer,
  StyledMainContent,
  GlobalBlack,
} from '../../styles/pages-styles/VideochatStyles';

// Navbar unificada
import {
  StyledNavbar,
  StyledBrand,
  NavText,
  HamburgerButton,
  MobileMenu,
} from '../../styles/NavbarStyles';

import { ProfilePrimaryButton,NavButton } from '../../styles/ButtonStyles';

// Estilos de tarjetas ya existentes (perfil) + nuevos
import {
  Hint,
  CenteredMain,
  OnboardingCard,
  ButtonPrimary,
} from '../../styles/subpages/PerfilClientModelStyle';

const DashboardUserModel = () => {
  const history = useHistory();
  const token = localStorage.getItem('token');

  const [userName, setUserName] = useState('Modelo');
  const [info, setInfo] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!token) {
      history.push('/');
      return;
    }
    (async () => {
      try {
        const res = await fetch('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          localStorage.removeItem('token');
          history.push('/');
          return;
        }
        if (res.ok) {
          const data = await res.json();
          setUserName(
            data.nickname || data.name || data.email || 'Usuario'
          );
          setInfo(
            `Estado de verificación: ${
              data.verificationStatus || 'PENDING'
            }`
          );
        }
      } catch {
        // noop
      }
    })();
  }, [token, history]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    history.push('/');
  };

  const handleUploadDocs = () => {
    history.push('/model-documents');
  };

  const displayName = userName || 'Modelo';

  return (
    <StyledContainer>
      <GlobalBlack />

      {/* NAVBAR unificada */}
      <StyledNavbar>
        <StyledBrand
          href="#"
          aria-label="SharemeChat"
          onClick={(e) => e.preventDefault()}
        />

        {/* Desktop */}
        <div
          className="desktop-only"
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            marginLeft: 'auto',
          }}
        >
          <NavText className="me-3">{displayName}</NavText>

          <NavButton
            type="button"
            onClick={handleLogout}
            title="Cerrar sesión"
          >
            Salir
          </NavButton>
        </div>

        {/* Móvil: hamburguesa */}
        <HamburgerButton
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Abrir menú"
          title="Menú"
        >
          ☰
        </HamburgerButton>

        <MobileMenu className={!menuOpen && 'hidden'}>
          <NavText style={{ marginBottom: 8 }}>
            Hola, {displayName}
          </NavText>

          <NavButton
            type="button"
            onClick={() => {
              handleUploadDocs();
              setMenuOpen(false);
            }}
          >
            Subir documentos
          </NavButton>

          <NavButton
            type="button"
            onClick={() => {
              handleLogout();
              setMenuOpen(false);
            }}
          >
            Salir
          </NavButton>
        </MobileMenu>
      </StyledNavbar>

      {/* MAIN: tarjeta centrada de verificación */}
      <StyledMainContent data-tab="onboarding">
        <CenteredMain>
          <OnboardingCard>
            <h3>Completa tu verificación de Modelo</h3>

            {info && <Hint style={{ marginTop: 8 }}>{info}</Hint>}

            <div style={{ marginTop: 16 }}>
              <ProfilePrimaryButton
                type="button"
                onClick={() => history.push('/model-documents')}
              >
                Actualizar / Subir documentos
              </ProfilePrimaryButton>
            </div>

            <Hint style={{ marginTop: 12 }}>
              Una vez validados por el administrador, tu cuenta pasará a{' '}
              <strong>MODEL</strong>.
            </Hint>
          </OnboardingCard>
        </CenteredMain>
      </StyledMainContent>
    </StyledContainer>
  );
};

export default DashboardUserModel;
