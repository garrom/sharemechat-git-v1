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

import { ProfilePrimaryButton, NavButton } from '../../styles/ButtonStyles';

// Estilos de tarjetas ya existentes (perfil) + nuevos
import {
  Hint,
  CenteredMain,
  OnboardingCard,
} from '../../styles/subpages/PerfilClientModelStyle';

import { useSession } from '../../components/SessionProvider';
import { apiFetch } from '../../config/http';

const DashboardUserModel = () => {
  const history = useHistory();
  const { user: sessionUser, loading: sessionLoading } = useSession();

  const [userName, setUserName] = useState('Modelo');
  const [info, setInfo] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  // ===== CONTRATO LEGAL (modelo) =====
  const [contractCurrent, setContractCurrent] = useState(null);
  const [contractAccepted, setContractAccepted] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [contractErr, setContractErr] = useState('');

  // UX: obligar a abrir el PDF + checkbox antes de permitir "Acepto"
  const [openedContract, setOpenedContract] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);

  // Estado KYC (routing + modo activo)
  const [routingKyc, setRoutingKyc] = useState(false);
  const [kycRouteErr, setKycRouteErr] = useState('');
  const [kycMode, setKycMode] = useState('');

  useEffect(() => {
    if (sessionLoading) return;

    if (!sessionUser) {
      history.push('/');
      return;
    }

    setUserName(sessionUser.nickname || sessionUser.name || sessionUser.email || 'Usuario');
    setInfo(`Estado de verificación: ${sessionUser.verificationStatus || 'PENDING'}`);
  }, [sessionUser, sessionLoading, history]);

  // Cargar contrato vigente + estado aceptación (auth)
  useEffect(() => {
    if (sessionLoading) return;
    if (!sessionUser) return;

    let cancelled = false;

    const run = async () => {
      try {
        const cur = await apiFetch('/consent/model-contract/current');
        const st = await apiFetch('/consent/model-contract/status');

        if (cancelled) return;

        setContractCurrent(cur || null);
        setContractAccepted(Boolean(st?.accepted));

        if (Boolean(st?.accepted)) {
          setOpenedContract(true);
          setConfirmChecked(true);
        } else {
          setOpenedContract(false);
          setConfirmChecked(false);
        }
      } catch (e) {
        if (cancelled) return;
        setContractErr('No se pudo cargar el contrato legal. Intenta recargar.');
        setContractAccepted(null);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [sessionUser, sessionLoading]);

  // Cargar modo KYC activo (solo informativo para el botón/UX)
  useEffect(() => {
    if (sessionLoading) return;
    if (!sessionUser) return;
    if (contractAccepted !== true) return;

    let cancelled = false;

    const loadKycMode = async () => {
      try {
        const entry = await apiFetch('/kyc/config/model-onboarding');
        if (cancelled) return;

        const mode = String(entry?.activeMode || '').toUpperCase();
        setKycMode(mode);
      } catch (e) {
        if (cancelled) return;
        setKycMode('');
      }
    };

    loadKycMode();

    return () => {
      cancelled = true;
    };
  }, [sessionUser, sessionLoading, contractAccepted]);

  const handleAcceptContract = async () => {
    setAccepting(true);
    setContractErr('');

    try {
      await apiFetch('/consent/model-contract/accept', { method: 'POST' });
      setContractAccepted(true);
      setOpenedContract(true);
      setConfirmChecked(true);

      // Tras aceptar, intentamos cargar el modo KYC activo
      try {
        const entry = await apiFetch('/kyc/config/model-onboarding');
        const mode = String(entry?.activeMode || '').toUpperCase();
        setKycMode(mode);
      } catch {
        setKycMode('');
      }
    } catch (e) {
      setContractErr('No se pudo registrar la aceptación. Inténtalo de nuevo.');
    } finally {
      setAccepting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      /* noop */
    }
    history.push('/');
  };

  // Decide flujo (MANUAL vs VERIFF) desde backend
  const handleUploadDocs = async () => {
    setRoutingKyc(true);
    setKycRouteErr('');

    try {
      const entry = await apiFetch('/kyc/config/model-onboarding');
      const mode = String(entry?.activeMode || '').toUpperCase();

      setKycMode(mode);

      if (mode === 'MANUAL') {
        history.push('/model-documents');
        return;
      }

      if (mode === 'VERIFF') {
        history.push('/model-kyc');
        return;
      }

      setKycRouteErr(`Modo KYC no soportado: ${mode || 'N/D'}`);
    } catch (e) {
      setKycRouteErr('No se pudo obtener el flujo KYC. Inténtalo de nuevo.');
    } finally {
      setRoutingKyc(false);
    }
  };

  const displayName = userName || 'Modelo';
  const mustAcceptContract = contractAccepted === false;
  const canAcceptContract = openedContract && confirmChecked && !accepting;

  const mainButtonLabel =
    kycMode === 'VERIFF'
      ? 'Ir a Veriff'
      : kycMode === 'MANUAL'
      ? 'Subir documentos (manual)'
      : 'Actualizar / Subir documentos';

  const mobileButtonLabel =
    kycMode === 'VERIFF'
      ? 'Ir a Veriff'
      : kycMode === 'MANUAL'
      ? 'Subir documentos'
      : 'Subir documentos';

  if (sessionLoading) {
    return (
      <StyledContainer>
        <GlobalBlack />
        <StyledMainContent>
          <div style={{ padding: 16, color: '#fff' }}>Cargando sesión…</div>
        </StyledMainContent>
      </StyledContainer>
    );
  }

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
          style={{ display: 'flex', gap: 12, alignItems: 'center', marginLeft: 'auto' }}
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
            onClick={async () => {
              await handleUploadDocs();
              setMenuOpen(false);
            }}
            disabled={mustAcceptContract || routingKyc}
            title={mustAcceptContract ? 'Debes aceptar el contrato primero' : undefined}
          >
            {routingKyc ? 'Abriendo KYC…' : mobileButtonLabel}
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

            {info && <Hint style={{ marginTop: 8, color: '#000' }}>{info}</Hint>}

            {/* CONTRATO LEGAL (gating UX) */}
            {contractAccepted === false && (
              <div style={{ marginTop: 16 }}>
                <Hint>
                  Antes de continuar, debes aceptar el contrato legal de modelo.
                </Hint>

                {contractCurrent?.url && (
                  <Hint style={{ marginTop: 8, color: '#000' }}>
                    <a
                      href={contractCurrent.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setOpenedContract(true)}
                      style={{ color: '#000', textDecoration: 'underline' }}
                    >
                      Ver contrato (PDF)
                    </a>
                  </Hint>
                )}

                <div style={{ marginTop: 10 }}>
                  <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={confirmChecked}
                      onChange={(e) => setConfirmChecked(e.target.checked)}
                    />
                    <span style={{ color: '#000' }}>
                      He leído y acepto el contrato de modelo
                    </span>
                  </label>
                </div>

                <div style={{ marginTop: 12 }}>
                  <ProfilePrimaryButton
                    type="button"
                    onClick={handleAcceptContract}
                    disabled={!canAcceptContract}
                    title={
                      accepting
                        ? 'Registrando aceptación…'
                        : !openedContract
                        ? 'Abre el contrato (PDF) primero'
                        : !confirmChecked
                        ? 'Marca la casilla para continuar'
                        : 'Aceptar contrato'
                    }
                  >
                    {accepting ? 'Registrando aceptación…' : 'Acepto el contrato'}
                  </ProfilePrimaryButton>
                </div>

                {contractErr && <Hint style={{ marginTop: 10 }}>{contractErr}</Hint>}
              </div>
            )}

            {/* Si contractAccepted === null (no pudimos cargar) mostramos aviso */}
            {contractAccepted === null && contractErr && (
              <div style={{ marginTop: 16 }}>
                <Hint>{contractErr}</Hint>
              </div>
            )}

            {contractAccepted === true && kycMode && (
              <Hint style={{ marginTop: 12, color: '#000' }}>
                Método KYC activo: <strong>{kycMode}</strong>
              </Hint>
            )}

            <div style={{ marginTop: 16 }}>
              <ProfilePrimaryButton
                type="button"
                onClick={handleUploadDocs}
                disabled={mustAcceptContract || routingKyc}
                title={mustAcceptContract ? 'Debes aceptar el contrato primero' : undefined}
              >
                {routingKyc ? 'Abriendo verificación…' : mainButtonLabel}
              </ProfilePrimaryButton>
            </div>

            {kycRouteErr && (
              <Hint style={{ marginTop: 10 }}>
                {kycRouteErr}
              </Hint>
            )}

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