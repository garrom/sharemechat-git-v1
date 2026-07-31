// MasterKycDiditProcessingPage.jsx — ADR-056 Fase S5.a fix.
// Página intermedia tras volver de Didit en el flujo MASTER. Polling
// /api/masters/me/overview cada 3s hasta 60s para detectar cambio de
// verificationStatus. Cuando llega APPROVED, redirige a /master.
// Ruta: /master-kyc-didit/processing, RequireRole=MASTER.
// Paralela a ModelKycDiditProcessingPage.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import i18n from '../../i18n';
import masterApi from '../../api/masterApi';
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

const t = (k) => i18n.t(k);

const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 20; // 20 x 3s = 60s timeout
const DEFAULT_RETURN_PATH = '/master';

export default function MasterKycDiditProcessingPage() {
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
      const data = await masterApi.getOverview();
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
      // Fallo puntual: sigue polling.
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
        <StyledBrand href="#" aria-label="SharemeChat" onClick={(e) => e.preventDefault()} />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginLeft: 'auto' }}>
          <NavText>{t('masterKyc.navTitle')}</NavText>
        </div>
      </StyledNavbar>

      <StyledMainContent data-tab="master-kyc-processing">
        <CenteredMain>
          <OnboardingCard>
            {isPolling && (
              <>
                <h3>{t('masterKyc.processing.title')}</h3>
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
                  {t('masterKyc.processing.subtitle')}
                </Hint>
                <style>{`@keyframes sm-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              </>
            )}

            {isRejected && (
              <>
                <h3>{t('masterKyc.title')}</h3>
                <div role="alert" style={{ marginTop: 16, color: '#842029' }}>
                  {t('masterKyc.processing.rejected')}
                </div>
                <div style={{ marginTop: 16 }}>
                  <NavButton type="button" onClick={goBack}>
                    {t('masterKyc.processing.back')}
                  </NavButton>
                </div>
              </>
            )}

            {isTimeout && (
              <>
                <h3>{t('masterKyc.processing.title')}</h3>
                <Hint style={{ marginTop: 16, color: '#000' }}>
                  {t('masterKyc.processing.timeout')}
                </Hint>
                <div style={{ marginTop: 16 }}>
                  <NavButton type="button" onClick={goBack}>
                    {t('masterKyc.processing.back')}
                  </NavButton>
                </div>
              </>
            )}
          </OnboardingCard>
        </CenteredMain>
      </StyledMainContent>
    </StyledContainer>
  );
}
