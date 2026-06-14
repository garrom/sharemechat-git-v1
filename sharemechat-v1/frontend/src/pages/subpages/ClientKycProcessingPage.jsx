import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import i18n from '../../i18n';

import { apiFetch } from '../../config/http';
import {
  CLIENT_KYC_RETURN_URL_KEY,
  CLIENT_KYC_DEFAULT_RETURN_PATH,
  isInternalReturnPath,
} from '../../utils/clientKycGate';

import {
  StyledContainer,
  StyledMainContent,
  GlobalBlack,
} from '../../styles/pages-styles/VideochatStyles';

import {
  StyledNavbar,
  StyledBrand,
  NavText,
} from '../../styles/NavbarStyles';

import { NavButton } from '../../styles/ButtonStyles';

import {
  Hint,
  CenteredMain,
  OnboardingCard,
} from '../../styles/subpages/PerfilClientModelStyle';

const tk = (key) => i18n.t(key);

const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 20; // 20 x 3s = 60s timeout

const readReturnUrl = () => {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const raw = window.sessionStorage.getItem(CLIENT_KYC_RETURN_URL_KEY);
      if (raw && isInternalReturnPath(raw)) return raw;
    }
  } catch {
    // Ignorar errores de storage
  }
  return CLIENT_KYC_DEFAULT_RETURN_PATH;
};

const clearReturnUrl = () => {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(CLIENT_KYC_RETURN_URL_KEY);
    }
  } catch {
    // Ignorar
  }
};

/**
 * Pagina intermedia tras volver de Didit. Polling /api/users/me cada 3s
 * hasta 60s para detectar el cambio de client_kyc_status. Cuando llega
 * APPROVED, redirige al returnUrl guardado en sessionStorage.
 *
 * Estados terminales:
 *  - APPROVED  -> push(returnUrl) + clear sessionStorage.
 *  - REJECTED  -> muestra mensaje + boton "Volver al dashboard".
 *  - timeout (20 intentos) -> muestra mensaje + boton "Volver".
 *
 * Frente "Integracion Age Verification con add-balance/first" paso 2
 * (2026-06-15).
 */
const ClientKycProcessingPage = () => {
  const history = useHistory();
  const [terminalState, setTerminalState] = useState(null); // 'rejected' | 'timeout' | null
  const attemptsRef = useRef(0);
  const cancelledRef = useRef(false);
  const timeoutRef = useRef(null);

  const goBack = useCallback(() => {
    const url = readReturnUrl();
    clearReturnUrl();
    history.push(url);
  }, [history]);

  const poll = useCallback(async () => {
    if (cancelledRef.current) return;

    try {
      const data = await apiFetch('/users/me');
      if (cancelledRef.current) return;
      const status = data && data.clientKycStatus;

      if (status === 'APPROVED') {
        const url = readReturnUrl();
        clearReturnUrl();
        history.push(url);
        return;
      }
      if (status === 'REJECTED') {
        setTerminalState('rejected');
        return;
      }
    } catch {
      // Fallo puntual de /users/me (red, refresh): no aborta el polling.
    }

    attemptsRef.current += 1;
    if (attemptsRef.current >= MAX_ATTEMPTS) {
      setTerminalState('timeout');
      return;
    }
    timeoutRef.current = setTimeout(poll, POLL_INTERVAL_MS);
  }, [history]);

  useEffect(() => {
    cancelledRef.current = false;
    attemptsRef.current = 0;
    // Arrancamos el polling inmediatamente; los reintentos se programan
    // con setTimeout dentro de poll().
    poll();

    return () => {
      cancelledRef.current = true;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [poll]);

  const isRejected = terminalState === 'rejected';
  const isTimeout = terminalState === 'timeout';
  const isPolling = !isRejected && !isTimeout;

  return (
    <StyledContainer>
      <GlobalBlack />

      <StyledNavbar>
        <StyledBrand
          href="#"
          aria-label="SharemeChat"
          onClick={(e) => e.preventDefault()}
        />

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginLeft: 'auto' }}>
          <NavText>{tk('clientKyc.navTitle')}</NavText>
        </div>
      </StyledNavbar>

      <StyledMainContent data-tab="client-kyc-processing">
        <CenteredMain>
          <OnboardingCard>
            {isPolling ? (
              <>
                <h3>{tk('clientKyc.processing.title')}</h3>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
                  <div
                    aria-label="loading"
                    style={{
                      width: 40,
                      height: 40,
                      border: '4px solid rgba(0,0,0,0.15)',
                      borderTopColor: '#664d03',
                      borderRadius: '50%',
                      animation: 'sm-spin 1s linear infinite',
                    }}
                  />
                </div>
                <Hint style={{ marginTop: 16, color: '#000', textAlign: 'center' }}>
                  {tk('clientKyc.processing.subtitle')}
                </Hint>
                <style>{`@keyframes sm-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              </>
            ) : null}

            {isRejected ? (
              <>
                <h3>{tk('clientKyc.title')}</h3>
                <div role="alert" style={{ marginTop: 16, color: '#842029' }}>
                  {tk('clientKyc.processing.rejected')}
                </div>
                <div style={{ marginTop: 16 }}>
                  <NavButton type="button" onClick={goBack}>
                    {tk('clientKyc.processing.back')}
                  </NavButton>
                </div>
              </>
            ) : null}

            {isTimeout ? (
              <>
                <h3>{tk('clientKyc.processing.title')}</h3>
                <Hint style={{ marginTop: 16, color: '#000' }}>
                  {tk('clientKyc.processing.timeout')}
                </Hint>
                <div style={{ marginTop: 16 }}>
                  <NavButton type="button" onClick={goBack}>
                    {tk('clientKyc.processing.back')}
                  </NavButton>
                </div>
              </>
            ) : null}
          </OnboardingCard>
        </CenteredMain>
      </StyledMainContent>
    </StyledContainer>
  );
};

export default ClientKycProcessingPage;
