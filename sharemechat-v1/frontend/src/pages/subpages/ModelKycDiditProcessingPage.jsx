import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import i18n from '../../i18n';

import { apiFetch } from '../../config/http';

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
const DEFAULT_RETURN_PATH = '/dashboard-user-model';

/**
 * Pagina intermedia tras volver de Didit en el flujo MODELO. Polling
 * /api/users/me cada 3s hasta 60s para detectar el cambio de
 * verificationStatus (el campo del modelo, NO clientKycStatus). Cuando
 * llega APPROVED, redirige a /dashboard-user-model.
 *
 * Paralela a ClientKycProcessingPage del frente "Integracion Age
 * Verification con add-balance/first" (2026-06-15). Separada porque:
 *  - El campo a observar es distinto (verificationStatus vs clientKycStatus).
 *  - El return path por defecto es /dashboard-user-model (no /client).
 *  - El RequireRole de la Route filtra por FORM_MODEL (no FORM_CLIENT).
 *  - Los textos i18n son del flujo modelo (verificar identidad y
 *    documento, no edad).
 *
 * Cierra deuda P11 (registrada al cierre del frente Email Gate + Age
 * Verification, 2026-06-14) y bug en cascada detectado en paso 3 del
 * frente Didit modelo (2026-06-19).
 */
const ModelKycDiditProcessingPage = () => {
  const history = useHistory();
  const [terminalState, setTerminalState] = useState(null); // 'rejected' | 'timeout' | null
  const attemptsRef = useRef(0);
  const cancelledRef = useRef(false);
  const timeoutRef = useRef(null);

  const goBack = useCallback(() => {
    history.push(DEFAULT_RETURN_PATH);
  }, [history]);

  const poll = useCallback(async () => {
    if (cancelledRef.current) return;

    try {
      const data = await apiFetch('/users/me');
      if (cancelledRef.current) return;
      const status = data && data.verificationStatus;

      if (status === 'APPROVED') {
        history.push(DEFAULT_RETURN_PATH);
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
          <NavText>{tk('modelKyc.navTitle')}</NavText>
        </div>
      </StyledNavbar>

      <StyledMainContent data-tab="model-kyc-processing">
        <CenteredMain>
          <OnboardingCard>
            {isPolling ? (
              <>
                <h3>{tk('modelKyc.processing.title')}</h3>
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
                  {tk('modelKyc.processing.subtitle')}
                </Hint>
                <style>{`@keyframes sm-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              </>
            ) : null}

            {isRejected ? (
              <>
                <h3>{tk('modelKyc.title')}</h3>
                <div role="alert" style={{ marginTop: 16, color: '#842029' }}>
                  {tk('modelKyc.processing.rejected')}
                </div>
                <div style={{ marginTop: 16 }}>
                  <NavButton type="button" onClick={goBack}>
                    {tk('modelKyc.processing.back')}
                  </NavButton>
                </div>
              </>
            ) : null}

            {isTimeout ? (
              <>
                <h3>{tk('modelKyc.processing.title')}</h3>
                <Hint style={{ marginTop: 16, color: '#000' }}>
                  {tk('modelKyc.processing.timeout')}
                </Hint>
                <div style={{ marginTop: 16 }}>
                  <NavButton type="button" onClick={goBack}>
                    {tk('modelKyc.processing.back')}
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

export default ModelKycDiditProcessingPage;
