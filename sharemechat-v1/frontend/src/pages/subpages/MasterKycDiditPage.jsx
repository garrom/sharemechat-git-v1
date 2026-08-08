// MasterKycDiditPage.jsx — ADR-056 Fase S5.a fix.
// Pagina de arranque del KYC persona fisica del Master.
// Consume POST /api/masters/me/kyc/didit (S2) y redirige a Didit.
// Simetrico a ModelKycDiditPage pero adaptado al rol MASTER.
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import i18n from '../../i18n';
import masterApi from '../../api/masterApi';
import {
  DashboardShell,
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

export default function MasterKycDiditPage() {
  const history = useHistory();
  const [consentChecked, setConsentChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleBack = () => history.push('/master');

  const handleStart = async () => {
    if (!consentChecked || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const data = await masterApi.startDiditKyc();
      const url = data && (data.verificationUrl || data.url);
      if (url) {
        window.location.href = url;
        return;
      }
      setError(t('masterKyc.errors.generic'));
    } catch (e) {
      const message = e?.data?.error || e?.message || '';
      if (message.toLowerCase().includes('approved')) {
        setError(t('masterKyc.errors.alreadyApproved'));
      } else if (message.toLowerCase().includes('contract')) {
        setError(t('masterKyc.errors.contractRequired'));
      } else {
        setError(t('masterKyc.errors.generic'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardShell>
      <GlobalBlack />

      <StyledNavbar>
        <StyledBrand href="#" aria-label="SharemeChat" onClick={(e) => e.preventDefault()} />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginLeft: 'auto' }}>
          <NavText>{t('masterKyc.navTitle')}</NavText>
          <NavButton type="button" onClick={handleBack}>
            {t('masterKyc.back')}
          </NavButton>
        </div>
      </StyledNavbar>

      <StyledMainContent data-tab="master-kyc">
        <CenteredMain>
          <OnboardingCard>
            <h3>{t('masterKyc.title')}</h3>

            <Hint style={{ marginTop: 12, color: '#000' }}>{t('masterKyc.intro')}</Hint>

            <Hint style={{ marginTop: 12, color: '#000' }}>{t('masterKyc.whyLegal')}</Hint>

            <div style={{ marginTop: 24, padding: 12, border: '1px solid #ccc', borderRadius: 6 }}>
              <strong>{t('masterKyc.consentTitle')}</strong>
              <p style={{ marginTop: 8, color: '#000' }}>{t('masterKyc.consentText')}</p>
              <p style={{ marginTop: 8, color: '#000' }}>
                <a href="/legal?tab=privacy" target="_blank" rel="noreferrer">
                  {t('masterKyc.consentReadMore')}
                </a>
              </p>
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12, color: '#000' }}>
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                />
                <span>{t('masterKyc.consentAck')}</span>
              </label>
            </div>

            {error && (
              <div role="alert" style={{ marginTop: 16, color: '#b00020' }}>
                {error}
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <NavButton type="button" onClick={handleStart} disabled={!consentChecked || submitting}>
                {submitting ? t('masterKyc.startingButton') : t('masterKyc.startButton')}
              </NavButton>
            </div>
          </OnboardingCard>
        </CenteredMain>
      </StyledMainContent>
    </DashboardShell>
  );
}
