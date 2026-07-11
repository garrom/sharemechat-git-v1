// src/pages/subpages/AffiliatePanelModel.jsx
//
// ADR-049 Subpasada 2D: panel real del programa de afiliadas de la modelo.
// Reemplaza el placeholder de la Subpasada 2C con:
//   - Estado "no activado": card explicativa + boton Activar programa.
//   - Estado "activado": URL de referido + boton Copiar + QR renderizado
//     inline (fetch a /qr.svg -> Blob -> object URL) + boton Descargar QR
//     + grid de 4 stats.
//
// Consume: GET /api/models/me/affiliate, POST /activate, GET /qr.svg.
// Auth: cookie access_token (same-site) via apiFetch + fetch nativo. El
// proyecto NO usa Bearer en el frontend (CookieJwtAuthenticationFilter
// en el backend).
//
// Estilos: reutiliza styled-components de EstadisticaStyles para
// coherencia visual completa con el resto del panel de la modelo.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faShareNodes,
  faCopy,
  faCheck,
  faDownload,
  faRotateRight,
} from '@fortawesome/free-solid-svg-icons';

import i18n from '../../i18n';
import { getResolvedLocale } from '../../i18n/localeUtils';
import { useSession } from '../../components/SessionProvider';
import NavbarModel from '../../components/navbar/NavbarModel';
import { StyledContainer } from '../../styles/NavbarStyles';
import {
  Wrap,
  TopBar,
  TopLeft,
  TopIcon,
  Title,
  SubTitle,
  TopRight,
  ReloadBtn,
  Section,
  SectionHead,
  SectionTitle,
  SectionHint,
  GridCards,
  MiniCard,
  MiniLabel,
  MiniValue,
  MiniMeta,
  StateLine,
  ErrorLine,
  Placeholder,
  PlaceholderTitle,
  PlaceholderText,
} from '../../styles/pages-styles/EstadisticaStyles';

import {
  getAffiliateDashboard,
  activateAffiliate,
  fetchAffiliateQrBlob,
} from '../../api/affiliateApi';

// ============================================================
// Loader centralizado sencillo (M3): spinner circular inline.
// ============================================================
const loaderOuterStyle = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '48px 16px',
};
const loaderSpinnerStyle = {
  width: 40,
  height: 40,
  border: '3px solid rgba(15,23,42,0.12)',
  borderTopColor: 'rgba(34,163,74,0.9)',
  borderRadius: '50%',
  animation: 'affiliateSpin 1s linear infinite',
};

// Inyeccion one-shot del keyframe (evitamos crear fichero CSS por 1 anim).
const KEYFRAMES_ID = 'affiliate-spin-keyframes';
const ensureKeyframes = () => {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement('style');
  style.id = KEYFRAMES_ID;
  style.textContent = '@keyframes affiliateSpin { to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
};

// ============================================================
// Estilos ad-hoc para las secciones URL / QR (coherentes con el
// resto del proyecto: fondos claros, radios 8-12, borde sutil).
// ============================================================
const urlRowStyle = {
  display: 'flex',
  gap: 8,
  alignItems: 'stretch',
  flexWrap: 'wrap',
  marginTop: 8,
};
const urlInputStyle = {
  flex: '1 1 240px',
  minWidth: 0,
  height: 40,
  padding: '0 12px',
  borderRadius: 12,
  border: '1px solid rgba(15,23,42,0.14)',
  background: 'rgba(255,255,255,0.9)',
  color: 'rgba(2,6,23,0.88)',
  fontSize: '0.95rem',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};
const qrPanelStyle = {
  display: 'flex',
  gap: 16,
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  marginTop: 8,
};
const qrCardStyle = {
  background: '#ffffff',
  padding: 12,
  borderRadius: 12,
  border: '1px solid rgba(15,23,42,0.14)',
  width: 232,
  height: 232,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  flexShrink: 0,
};
const qrImgStyle = {
  width: 208,
  height: 208,
  display: 'block',
};
const qrActionsColStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  minWidth: 0,
  flex: '1 1 200px',
};

// ============================================================
// Componente
// ============================================================
const AffiliatePanelModel = () => {
  const t = (key, options) => i18n.t(key, options);
  const history = useHistory();
  const { user: sessionUser } = useSession();

  const goDashboard = useCallback(() => history.push('/model'), [history]);
  const goProfile = useCallback(() => history.push('/perfil-model'), [history]);

  const displayName = sessionUser?.nickname || sessionUser?.email || '';

  // --- Estado principal del panel ------------------------------------
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  // --- Estado de activacion ------------------------------------------
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState(null);

  // --- Estado del feedback "URL copiada" -----------------------------
  const [copiedAt, setCopiedAt] = useState(0);

  // --- Estado del QR (blob + object URL) ------------------------------
  const [qrObjectUrl, setQrObjectUrl] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState(null);
  const [qrReloadTick, setQrReloadTick] = useState(0);
  const objectUrlRef = useRef(null);

  useEffect(() => {
    ensureKeyframes();
  }, []);

  // --- Carga inicial + recarga manual (boton Reload) -----------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getAffiliateDashboard();
        if (!cancelled) setDashboard(data);
      } catch (err) {
        if (!cancelled) {
          setError(err?.data?.message || err?.message || t('affiliate.errors.loading'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadTick, t]);

  // --- Fetch del QR cuando la modelo esta activada -------------------
  useEffect(() => {
    if (!dashboard?.active) return undefined;

    let cancelled = false;
    setQrLoading(true);
    setQrError(null);

    (async () => {
      try {
        const blob = await fetchAffiliateQrBlob();
        if (cancelled) return;
        // Revoca el anterior (si existiera) antes de crear el nuevo.
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = null;
        }
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        setQrObjectUrl(url);
      } catch (err) {
        if (!cancelled) {
          setQrError(err?.message || t('affiliate.errors.qr'));
          setQrObjectUrl(null);
        }
      } finally {
        if (!cancelled) setQrLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [dashboard?.active, qrReloadTick, t]);

  // Cleanup adicional en unmount (defensivo por si el useEffect anterior
  // no llego a limpiar por unmount rapido durante fetch).
  useEffect(() => () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const handleActivate = useCallback(async () => {
    setActivating(true);
    setActivateError(null);
    try {
      await activateAffiliate();
      // Recargar el dashboard: pasa a estado activado.
      setReloadTick((n) => n + 1);
    } catch (err) {
      setActivateError(err?.data?.message || err?.message || t('affiliate.errors.generic'));
    } finally {
      setActivating(false);
    }
  }, [t]);

  const handleCopy = useCallback(async () => {
    const url = dashboard?.urlCanonical;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedAt(Date.now());
      setTimeout(() => setCopiedAt(0), 2000);
    } catch {
      // Fallback: seleccionar el input readonly y esperar Ctrl+C manual.
      // Muy raro en navegadores modernos; sin toast en ese caso.
    }
  }, [dashboard?.urlCanonical]);

  const handleReload = useCallback(() => setReloadTick((n) => n + 1), []);
  const handleRetryQr = useCallback(() => setQrReloadTick((n) => n + 1), []);

  // ---------- Helpers de formato -------------------------------------
  const locale = getResolvedLocale();
  const formatCentsEur = useCallback((cents) => {
    const value = Number(cents || 0) / 100;
    try {
      return new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', {
        style: 'currency',
        currency: 'EUR',
      }).format(value);
    } catch {
      return `€${value.toFixed(2)}`;
    }
  }, [locale]);

  // ---------- Render -------------------------------------------------
  const active = !!dashboard?.active;
  const code = dashboard?.code || '';
  const urlCanonical = dashboard?.urlCanonical || '';
  const stats = dashboard?.stats || {};
  const qrDownloadName = `sharemechat-afiliada-${code || 'code'}.svg`;

  return (
    <StyledContainer>
      <NavbarModel
        activeTab="afiliada"
        displayName={displayName}
        showBottomNav={false}
        showBalance={false}
        showQueue={false}
        onBrandClick={goDashboard}
        onGoVideochat={goDashboard}
        onGoFavorites={goDashboard}
        onGoBlog={goDashboard}
        onGoStats={goDashboard}
        onGoAffiliate={() => {}}
        affiliateDisabled={true}
        onProfile={goProfile}
        onWithdraw={goDashboard}
        onLogout={goDashboard}
      />

      <Wrap>
        <TopBar>
          <TopLeft>
            <TopIcon>
              <FontAwesomeIcon icon={faShareNodes} />
            </TopIcon>
            <div>
              <Title>{t('affiliate.title')}</Title>
              <SubTitle>{t('affiliate.description')}</SubTitle>
            </div>
          </TopLeft>
          <TopRight>
            <ReloadBtn type="button" onClick={handleReload} disabled={loading}>
              <FontAwesomeIcon icon={faRotateRight} style={{ marginRight: 6 }} />
              {t('affiliate.reload')}
            </ReloadBtn>
          </TopRight>
        </TopBar>

        {loading && (
          <div style={loaderOuterStyle} role="status" aria-live="polite">
            <div style={loaderSpinnerStyle} aria-hidden="true" />
          </div>
        )}

        {!loading && error && (
          <ErrorLine>{error}</ErrorLine>
        )}

        {/* ============= NO ACTIVADA ============= */}
        {!loading && !error && !active && (
          <Section>
            <SectionHead>
              <SectionTitle>{t('affiliate.notActivated.title')}</SectionTitle>
              <SectionHint>{t('affiliate.notActivated.description')}</SectionHint>
            </SectionHead>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
              <ReloadBtn type="button" onClick={handleActivate} disabled={activating}>
                {activating ? t('affiliate.notActivated.activating') : t('affiliate.notActivated.button')}
              </ReloadBtn>
              <SectionHint>{t('affiliate.notActivated.kycRequired')}</SectionHint>
              {activateError && <ErrorLine>{activateError}</ErrorLine>}
            </div>
          </Section>
        )}

        {/* ============= ACTIVADA ============= */}
        {!loading && !error && active && (
          <>
            {/* Seccion A - URL */}
            <Section>
              <SectionHead>
                <SectionTitle>{t('affiliate.activated.urlSection')}</SectionTitle>
              </SectionHead>
              <div style={urlRowStyle}>
                <input
                  type="text"
                  readOnly
                  value={urlCanonical}
                  onFocus={(e) => e.target.select()}
                  aria-label={t('affiliate.activated.urlSection')}
                  style={urlInputStyle}
                />
                <ReloadBtn
                  type="button"
                  onClick={handleCopy}
                  aria-label={t('affiliate.activated.copyButton')}
                >
                  <FontAwesomeIcon
                    icon={copiedAt ? faCheck : faCopy}
                    style={{ marginRight: 6 }}
                  />
                  {copiedAt ? t('affiliate.activated.copySuccess') : t('affiliate.activated.copyButton')}
                </ReloadBtn>
              </div>
            </Section>

            {/* Seccion B - QR */}
            <Section>
              <SectionHead>
                <SectionTitle>{t('affiliate.activated.qrSection')}</SectionTitle>
              </SectionHead>
              <div style={qrPanelStyle}>
                <div style={qrCardStyle}>
                  {qrLoading && (
                    <div style={loaderSpinnerStyle} aria-hidden="true" />
                  )}
                  {!qrLoading && qrObjectUrl && (
                    <img
                      src={qrObjectUrl}
                      alt={t('affiliate.activated.qrAlt', { code })}
                      style={qrImgStyle}
                    />
                  )}
                  {!qrLoading && qrError && (
                    <div style={{ textAlign: 'center', color: 'rgba(153,27,27,0.9)', fontSize: '0.9rem' }}>
                      {t('affiliate.activated.qrError')}
                    </div>
                  )}
                </div>
                <div style={qrActionsColStyle}>
                  {qrObjectUrl && !qrError ? (
                    <a
                      href={qrObjectUrl}
                      download={qrDownloadName}
                      style={{ textDecoration: 'none' }}
                    >
                      <ReloadBtn as="span" style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <FontAwesomeIcon icon={faDownload} style={{ marginRight: 6 }} />
                        {t('affiliate.activated.qrDownload')}
                      </ReloadBtn>
                    </a>
                  ) : null}
                  {qrError && (
                    <ReloadBtn type="button" onClick={handleRetryQr}>
                      <FontAwesomeIcon icon={faRotateRight} style={{ marginRight: 6 }} />
                      {t('affiliate.activated.qrRetry')}
                    </ReloadBtn>
                  )}
                  <SectionHint style={{ marginTop: 4 }}>
                    {t('affiliate.activated.qrHint')}
                  </SectionHint>
                </div>
              </div>
            </Section>

            {/* Seccion C - Stats */}
            <Section>
              <SectionHead>
                <SectionTitle>{t('affiliate.activated.statsSection')}</SectionTitle>
                <SectionHint>{t('affiliate.activated.statsRealtime')}</SectionHint>
              </SectionHead>
              <GridCards>
                <MiniCard $accent="blue">
                  <MiniLabel>{t('affiliate.activated.statsClicks')}</MiniLabel>
                  <MiniValue>{Number(stats.clicksTotal || 0)}</MiniValue>
                  <MiniMeta>{t('affiliate.activated.statsClicksMeta')}</MiniMeta>
                </MiniCard>
                <MiniCard>
                  <MiniLabel>{t('affiliate.activated.statsUniqueVisitors')}</MiniLabel>
                  <MiniValue>{Number(stats.clicksUniqueVisitors || 0)}</MiniValue>
                  <MiniMeta>{t('affiliate.activated.statsUniqueVisitorsMeta')}</MiniMeta>
                </MiniCard>
                <MiniCard $accent="green">
                  <MiniLabel>{t('affiliate.activated.statsReferred')}</MiniLabel>
                  <MiniValue>{Number(stats.clientsReferred || 0)}</MiniValue>
                  <MiniMeta>{t('affiliate.activated.statsReferredMeta')}</MiniMeta>
                </MiniCard>
                <MiniCard $accent="amber">
                  <MiniLabel>{t('affiliate.activated.statsCommission')}</MiniLabel>
                  <MiniValue>{formatCentsEur(stats.commissionAccruedCents)}</MiniValue>
                  <MiniMeta>{t('affiliate.activated.statsCommissionMeta')}</MiniMeta>
                </MiniCard>
              </GridCards>
            </Section>
          </>
        )}
      </Wrap>
    </StyledContainer>
  );
};

export default AffiliatePanelModel;
