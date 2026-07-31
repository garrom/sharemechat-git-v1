// MasterContractPage.jsx — ADR-056 Fase S5.a fix.
// Pagina de firma del Contrato Master. Muestra la version vigente
// (GET /me/contract) + checkbox de aceptacion + botón que llama a
// POST /me/contract/accept. Ruta: /master-contract, RequireRole=MASTER.
import React, { useCallback, useEffect, useState } from 'react';
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

export default function MasterContractPage() {
  const history = useHistory();
  const [manifest, setManifest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [pdfOpened, setPdfOpened] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const loadManifest = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await masterApi.getCurrentContract();
      setManifest(data);
    } catch (err) {
      setLoadError(err?.data?.error || t('masterContract.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadManifest(); }, [loadManifest]);

  const handleBack = () => history.push('/master');

  const handleAccept = async () => {
    if (!pdfOpened || !accepted || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await masterApi.acceptContract();
      setOkMsg(t('masterContract.status.accepted'));
      setTimeout(() => history.push('/master'), 1500);
    } catch (err) {
      setSubmitError(err?.data?.error || err?.message || t('masterContract.errors.acceptFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenPdf = () => {
    if (!manifest?.url) return;
    setPdfOpened(true);
    window.open(manifest.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <StyledContainer>
      <GlobalBlack />

      <StyledNavbar>
        <StyledBrand href="#" aria-label="SharemeChat" onClick={(e) => e.preventDefault()} />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginLeft: 'auto' }}>
          <NavText>{t('masterContract.navTitle')}</NavText>
          <NavButton type="button" onClick={handleBack}>
            {t('masterContract.back')}
          </NavButton>
        </div>
      </StyledNavbar>

      <StyledMainContent data-tab="master-contract">
        <CenteredMain>
          <OnboardingCard>
            <h3>{t('masterContract.title')}</h3>

            <Hint style={{ marginTop: 12, color: '#000' }}>{t('masterContract.intro')}</Hint>

            {loading && <p style={{ marginTop: 16, color: '#000' }}>{t('common.loading')}</p>}

            {loadError && (
              <div role="alert" style={{ marginTop: 16, color: '#b00020' }}>
                {loadError}
              </div>
            )}

            {manifest && (
              <div style={{ marginTop: 16, padding: 12, border: '1px solid #ccc', borderRadius: 6, color: '#000' }}>
                <p><strong>{t('masterContract.version')}:</strong> {manifest.version}</p>
                <p style={{ marginTop: 8 }}>
                  <NavButton type="button" onClick={handleOpenPdf}>
                    {t('masterContract.readPdf')}
                  </NavButton>
                  {pdfOpened && (
                    <span style={{ marginLeft: 12, color: '#0a7a2f', fontSize: '0.85rem' }}>
                      ✓ {t('masterContract.pdfOpenedOk')}
                    </span>
                  )}
                </p>
                <p style={{ marginTop: 8, fontSize: '0.8rem', opacity: 0.7 }}>
                  SHA-256: {manifest.sha256}
                </p>
              </div>
            )}

            {manifest && (
              <>
                <label
                  style={{
                    display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 16,
                    color: pdfOpened ? '#000' : '#999',
                    cursor: pdfOpened ? 'pointer' : 'not-allowed',
                  }}
                  title={pdfOpened ? undefined : t('masterContract.mustOpenPdfFirst')}
                >
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    disabled={!pdfOpened}
                  />
                  <span>{t('masterContract.acceptCheckbox')}</span>
                </label>

                {!pdfOpened && (
                  <Hint style={{ marginTop: 8, color: '#664d03' }}>
                    {t('masterContract.mustOpenPdfFirst')}
                  </Hint>
                )}

                {submitError && (
                  <div role="alert" style={{ marginTop: 16, color: '#b00020' }}>
                    {submitError}
                  </div>
                )}

                {okMsg && (
                  <div role="status" style={{ marginTop: 16, color: '#0a7a2f' }}>
                    {okMsg}
                  </div>
                )}

                <div style={{ marginTop: 16 }}>
                  <NavButton
                    type="button"
                    onClick={handleAccept}
                    disabled={!pdfOpened || !accepted || submitting || !!okMsg}
                  >
                    {submitting ? t('masterContract.submittingButton') : t('masterContract.submitButton')}
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
