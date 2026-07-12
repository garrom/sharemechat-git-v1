import React, { useEffect, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
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
  CenteredMain,
  OnboardingCard,
} from '../../styles/subpages/PerfilClientModelStyle';

const tk = (key, options) => i18n.t(key, options);

const readReturnPathFromUrl = (search) => {
  try {
    const params = new URLSearchParams(search || '');
    const raw = params.get('return');
    if (raw && isInternalReturnPath(raw)) return raw;
  } catch {
    // Ignoramos parsing inválido; el default se aplica abajo.
  }
  return null;
};

const ClientKycDiditPage = () => {
  const history = useHistory();
  const location = useLocation();
  const [consentChecked, setConsentChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // ?return=<path> en URL tiene prioridad. Si valido, se persiste en
  // sessionStorage para que la pagina /client-kyc/processing (tras
  // Didit) sepa donde volver. Si no, default /client.
  useEffect(() => {
    const fromUrl = readReturnPathFromUrl(location.search);
    if (fromUrl) {
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.setItem(CLIENT_KYC_RETURN_URL_KEY, fromUrl);
        }
      } catch {
        // sessionStorage no disponible: la pagina /processing tiene fallback.
      }
    }
  }, [location.search]);

  const handleBack = () => {
    const fromUrl = readReturnPathFromUrl(location.search);
    history.push(fromUrl || CLIENT_KYC_DEFAULT_RETURN_PATH);
  };

  const handleStart = async () => {
    if (!consentChecked || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const data = await apiFetch('/kyc/didit/client/start', { method: 'POST' });
      const url = data && (data.verificationUrl || data.url);
      if (url) {
        window.location.href = url;
        return;
      }
      setError(tk('clientKyc.errors.generic'));
    } catch (e) {
      const message = (e && e.message) || '';
      if (message.toLowerCase().includes('approved')) {
        setError(tk('clientKyc.errors.alreadyApproved'));
      } else {
        setError(tk('clientKyc.errors.generic'));
      }
    } finally {
      setSubmitting(false);
    }
  };

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
          <NavButton
            type="button"
            onClick={handleBack}
          >
            {tk('clientKyc.back')}
          </NavButton>
        </div>
      </StyledNavbar>

      <StyledMainContent data-tab="client-kyc">
        <CenteredMain>
          <OnboardingCard style={{ maxWidth: 560 }}>
            {/* Jerarquia tipografica: titulo grande + gancho, intro
                breve tamano medio, resto (contexto legal + consent)
                en letra pequena para no inflar el modal. */}
            <h2
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: '#1e3a8a',
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              {tk('clientKyc.title')}
            </h2>

            <p
              style={{
                fontSize: '0.95rem',
                lineHeight: 1.55,
                color: '#1f2933',
                margin: '10px 0 0',
              }}
            >
              {tk('clientKyc.intro')}
            </p>

            <p
              style={{
                fontSize: '0.78rem',
                lineHeight: 1.5,
                color: '#6b7683',
                margin: '10px 0 0',
              }}
            >
              {tk('clientKyc.whyLegal')}
            </p>

            <div
              style={{
                marginTop: 16,
                padding: '10px 12px',
                border: '1px solid #dde3ea',
                borderRadius: 10,
                background: '#f8fafb',
              }}
            >
              <div
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#1e3a8a',
                }}
              >
                {tk('clientKyc.consentTitle')}
              </div>
              <p
                style={{
                  fontSize: '0.78rem',
                  lineHeight: 1.5,
                  color: '#4a5563',
                  margin: '6px 0 0',
                }}
              >
                {tk('clientKyc.consentText')}
              </p>
              <p
                style={{
                  fontSize: '0.78rem',
                  lineHeight: 1.5,
                  color: '#4a5563',
                  margin: '6px 0 0',
                }}
              >
                {tk('clientKyc.consentReadMore')}
              </p>
              <label
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  marginTop: 10,
                  fontSize: '0.82rem',
                  color: '#1f2933',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  aria-describedby="client-kyc-consent-text"
                />
                <span id="client-kyc-consent-text">
                  {tk('clientKyc.consentAcceptLabel')}
                </span>
              </label>
            </div>

            {error ? (
              <div
                role="alert"
                style={{
                  marginTop: 12,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: '#fbf1f1',
                  border: '1px solid #dbbcbc',
                  color: '#8f5b5b',
                  fontSize: '0.82rem',
                }}
              >
                {error}
              </div>
            ) : null}

            <div style={{ marginTop: 16 }}>
              <NavButton
                type="button"
                onClick={handleStart}
                disabled={!consentChecked || submitting}
              >
                {submitting ? tk('clientKyc.startingButton') : tk('clientKyc.startButton')}
              </NavButton>
            </div>
          </OnboardingCard>
        </CenteredMain>
      </StyledMainContent>
    </StyledContainer>
  );
};

export default ClientKycDiditPage;
