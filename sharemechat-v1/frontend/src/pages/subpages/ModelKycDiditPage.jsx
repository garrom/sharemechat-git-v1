import React, { useState } from 'react';
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

const tk = (key, options) => i18n.t(key, options);

const ModelKycDiditPage = () => {
  const history = useHistory();
  const [consentChecked, setConsentChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleBack = () => {
    history.push('/dashboard-user-model');
  };

  const handleStart = async () => {
    if (!consentChecked || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const data = await apiFetch('/kyc/didit/model/start', { method: 'POST' });
      const url = data && (data.verificationUrl || data.url);
      if (url) {
        window.location.href = url;
        return;
      }
      setError(tk('modelKyc.errors.generic'));
    } catch (e) {
      const message = (e && e.message) || '';
      if (message.toLowerCase().includes('approved')) {
        setError(tk('modelKyc.errors.alreadyApproved'));
      } else {
        setError(tk('modelKyc.errors.generic'));
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
          <NavText>{tk('modelKyc.navTitle')}</NavText>
          <NavButton type="button" onClick={handleBack}>
            {tk('modelKyc.back')}
          </NavButton>
        </div>
      </StyledNavbar>

      <StyledMainContent data-tab="model-kyc">
        <CenteredMain>
          <OnboardingCard>
            <h3>{tk('modelKyc.title')}</h3>

            <Hint style={{ marginTop: 12, color: '#000' }}>
              {tk('modelKyc.intro')}
            </Hint>

            <Hint style={{ marginTop: 12, color: '#000' }}>
              {tk('modelKyc.whyLegal')}
            </Hint>

            <div style={{ marginTop: 24, padding: 12, border: '1px solid #ccc', borderRadius: 6 }}>
              <strong>{tk('modelKyc.consentTitle')}</strong>
              <p style={{ marginTop: 8, color: '#000' }}>
                {tk('modelKyc.consentText')}
              </p>
              <p style={{ marginTop: 8, color: '#000' }}>
                {tk('modelKyc.consentReadMore')}
              </p>
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12, color: '#000' }}>
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  aria-describedby="model-kyc-consent-text"
                />
                <span id="model-kyc-consent-text">
                  {tk('modelKyc.consentTitle')}
                </span>
              </label>
            </div>

            {error ? (
              <div role="alert" style={{ marginTop: 16, color: '#b00020' }}>
                {error}
              </div>
            ) : null}

            <div style={{ marginTop: 16 }}>
              <NavButton
                type="button"
                onClick={handleStart}
                disabled={!consentChecked || submitting}
              >
                {submitting ? tk('modelKyc.startingButton') : tk('modelKyc.startButton')}
              </NavButton>
            </div>
          </OnboardingCard>
        </CenteredMain>
      </StyledMainContent>
    </StyledContainer>
  );
};

export default ModelKycDiditPage;
