// DashboardMaster.jsx — ADR-056 Fase S5.a (S5.a.6 shell + Overview).
// SPA de una sola pagina con activeTab: overview | modelos | historial | payout.
// Patron consistente con DashboardClient y DashboardModel.
import React, { useCallback, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import i18n from '../../i18n';
import { apiFetch } from '../../config/http';
import { useSession } from '../../components/SessionProvider';
import { useAppModals } from '../../components/useAppModals';
import NavbarMaster from '../../components/navbar/NavbarMaster';
import MasterModelosPanel from '../../components/master/MasterModelosPanel';
import masterApi from '../../api/masterApi';

// ============================================================
// Estilos inline (patron MasterLanding.jsx). Refactor a
// styled-components si el bloque crece — de momento aisla el
// riesgo de romper otros dashboards.
// ============================================================
const PageWrap = { minHeight: '100vh', background: '#f9fafb' };
const Content = { maxWidth: 1200, margin: '0 auto', padding: '24px 16px 64px' };
const H1 = { margin: '0 0 6px', color: '#111827', fontSize: '1.6rem' };
const Subtitle = { margin: '0 0 24px', color: '#6b7280', fontSize: '0.95rem' };

const BannerBase = {
  border: '1px solid transparent',
  borderRadius: 10,
  padding: '12px 16px',
  marginBottom: 20,
  fontSize: '0.92rem',
};
const BannerWarn = { ...BannerBase, background: '#fef3c7', borderColor: '#fcd34d', color: '#92400e' };
const BannerAlert = { ...BannerBase, background: '#fee2e2', borderColor: '#fca5a5', color: '#991b1b' };
const BannerInfo = { ...BannerBase, background: '#e0e7ff', borderColor: '#a5b4fc', color: '#3730a3' };

const KpiGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 16,
  marginBottom: 28,
};
const KpiCard = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: '18px 20px',
};
const KpiLabel = { fontSize: '0.82rem', color: '#6b7280', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 };
const KpiValue = { fontSize: '1.6rem', color: '#111827', margin: '8px 0 0', fontWeight: 700 };
const KpiHint = { fontSize: '0.82rem', color: '#6b7280', margin: '6px 0 0' };

const SectionCard = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: '18px 20px',
  marginBottom: 20,
};
const SectionTitle = { margin: '0 0 12px', fontSize: '1.05rem', fontWeight: 700, color: '#111827' };
const EmptyText = { margin: 0, color: '#6b7280', fontSize: '0.92rem' };

const ActivityRow = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '10px 0', borderBottom: '1px solid #f3f4f6',
};
const ActivityLeft = { display: 'flex', flexDirection: 'column' };
const ActivityKind = { fontSize: '0.9rem', color: '#111827', fontWeight: 600 };
const ActivityWhen = { fontSize: '0.8rem', color: '#6b7280', marginTop: 2 };
const ActivityAmount = { fontSize: '0.95rem', fontWeight: 700 };

const TabPlaceholder = { ...SectionCard, textAlign: 'center', padding: '48px 20px', color: '#6b7280' };

// ============================================================
// Helpers
// ============================================================
const fmtEur = (n) => {
  if (n == null) return '—';
  try {
    return new Intl.NumberFormat(i18n.language || 'es', {
      style: 'currency', currency: 'EUR', maximumFractionDigits: 2,
    }).format(Number(n));
  } catch { return `${Number(n).toFixed(2)} €`; }
};
const fmtDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
};

// ============================================================
// Componente principal
// ============================================================
export default function DashboardMaster() {
  const history = useHistory();
  const { user: sessionUser } = useSession();
  const { alert } = useAppModals();

  const [activeTab, setActiveTab] = useState('overview');
  const [me, setMe] = useState(null);
  const [overview, setOverview] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resendState, setResendState] = useState({ loading: false, msg: '' });

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [meDto, ovDto, txPage] = await Promise.all([
        masterApi.getMe(),
        masterApi.getOverview(),
        masterApi.listTransactions({ page: 0, size: 5 }),
      ]);
      setMe(meDto);
      setOverview(ovDto);
      setRecent(Array.isArray(txPage?.items) ? txPage.items : []);
    } catch (err) {
      setError(err?.data?.error || err?.message || i18n.t('common.networkError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  const handleLogout = async () => {
    try { await apiFetch('/auth/logout', { method: 'POST' }); } catch {}
    history.push('/');
  };

  const handleResendVerification = async () => {
    if (resendState.loading) return;
    setResendState({ loading: true, msg: '' });
    try {
      await apiFetch('/email-verification/resend', { method: 'POST' });
      setResendState({ loading: false, msg: i18n.t('masterDashboard.banners.emailResendOk') });
    } catch (err) {
      setResendState({
        loading: false,
        msg: err?.data?.message || i18n.t('masterDashboard.banners.emailResendErr'),
      });
    }
  };

  const brandClick = (e) => { if (e?.preventDefault) e.preventDefault(); history.push('/'); };

  const balanceText = overview ? fmtEur(overview.balanceCurrent) : '';

  // Banners de estado (email verify → KYC → contrato).
  // Se muestran TODOS los que apliquen. Email verify es el mas critico
  // porque bloquea todas las acciones operativas (Opcion Z, 2026-07-30).
  const banners = [];
  if (overview) {
    if (overview.emailVerified === false) {
      banners.push(
        <div key="email" style={BannerAlert} role="alert">
          <div>{i18n.t('masterDashboard.banners.emailNotVerified')}</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resendState.loading}
              style={{
                appearance: 'none', border: '1px solid #991b1b', background: '#fff',
                color: '#991b1b', padding: '6px 14px', borderRadius: 8,
                cursor: resendState.loading ? 'wait' : 'pointer',
                fontSize: '0.85rem', fontWeight: 600,
              }}
            >
              {resendState.loading
                ? i18n.t('masterDashboard.banners.emailResendLoading')
                : i18n.t('masterDashboard.banners.emailResendCta')}
            </button>
            {resendState.msg && <span style={{ fontSize: '0.85rem' }}>{resendState.msg}</span>}
          </div>
        </div>
      );
    }
    if (overview.verificationStatus && overview.verificationStatus !== 'APPROVED') {
      banners.push(
        <div key="kyc" style={BannerAlert} role="alert">
          <div>{i18n.t('masterDashboard.banners.kycPending')}</div>
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={() => history.push('/master-kyc-didit')}
              style={{
                appearance: 'none', border: '1px solid #991b1b', background: '#fff',
                color: '#991b1b', padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                fontSize: '0.85rem', fontWeight: 600,
              }}
            >
              {i18n.t('masterDashboard.banners.kycCta')}
            </button>
          </div>
        </div>
      );
    }
    if (overview.contractAccepted === false) {
      banners.push(
        <div key="contract" style={BannerWarn} role="alert">
          <div>{i18n.t('masterDashboard.banners.contractPending')}</div>
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={() => history.push('/master-contract')}
              style={{
                appearance: 'none', border: '1px solid #92400e', background: '#fff',
                color: '#92400e', padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                fontSize: '0.85rem', fontWeight: 600,
              }}
            >
              {i18n.t('masterDashboard.banners.contractCta')}
            </button>
          </div>
        </div>
      );
    }
  }

  return (
    <div style={PageWrap}>
      <NavbarMaster
        activeTab={activeTab}
        displayName={me?.nickname || sessionUser?.nickname || ''}
        balanceTextDesktop={balanceText}
        balanceTextMobile={balanceText}
        onBrandClick={brandClick}
        onGoOverview={() => setActiveTab('overview')}
        onGoModelos={() => setActiveTab('modelos')}
        onGoHistorial={() => setActiveTab('historial')}
        onGoPayout={() => setActiveTab('payout')}
        onProfile={() => history.push('/perfil-master')}
        onLogout={handleLogout}
        showLocaleSwitcher={true}
        showBalance={true}
      />

      <div style={Content}>
        {error && <div style={BannerAlert} role="alert">{error}</div>}

        {activeTab === 'overview' && (
          <>
            <h1 style={H1}>{i18n.t('masterDashboard.overview.title')}</h1>
            <p style={Subtitle}>{i18n.t('masterDashboard.overview.subtitle')}</p>

            {banners}

            <div style={KpiGrid}>
              <div style={KpiCard}>
                <p style={KpiLabel}>{i18n.t('masterDashboard.kpi.gross30d')}</p>
                <p style={KpiValue}>{loading ? '—' : fmtEur(overview?.billedGrossEur30d)}</p>
                <p style={KpiHint}>{i18n.t('masterDashboard.kpi.gross30dHint')}</p>
              </div>
              <div style={KpiCard}>
                <p style={KpiLabel}>{i18n.t('masterDashboard.kpi.activeModels')}</p>
                <p style={KpiValue}>{loading ? '—' : (overview?.activeModelsCount ?? 0)}</p>
                <p style={KpiHint}>
                  {i18n.t('masterDashboard.kpi.pending', { count: overview?.pendingModelsCount ?? 0 })}
                </p>
              </div>
              <div style={KpiCard}>
                <p style={KpiLabel}>{i18n.t('masterDashboard.kpi.balance')}</p>
                <p style={KpiValue}>{loading ? '—' : fmtEur(overview?.balanceCurrent)}</p>
                <p style={KpiHint}>{i18n.t('masterDashboard.kpi.balanceHint')}</p>
              </div>
              <div style={KpiCard}>
                <p style={KpiLabel}>{i18n.t('masterDashboard.kpi.lastPayout')}</p>
                <p style={KpiValue}>
                  {loading ? '—' : (overview?.lastPayoutAmount ? fmtEur(overview.lastPayoutAmount) : '—')}
                </p>
                <p style={KpiHint}>
                  {overview?.lastPayoutAt ? fmtDate(overview.lastPayoutAt) : i18n.t('masterDashboard.kpi.lastPayoutNever')}
                </p>
              </div>
            </div>

            <div style={SectionCard}>
              <h2 style={SectionTitle}>{i18n.t('masterDashboard.recent.title')}</h2>
              {loading && <p style={EmptyText}>{i18n.t('common.loading')}</p>}
              {!loading && recent.length === 0 && (
                <p style={EmptyText}>{i18n.t('masterDashboard.recent.empty')}</p>
              )}
              {!loading && recent.length > 0 && (
                <div>
                  {recent.map((t) => (
                    <div key={t.id} style={ActivityRow}>
                      <div style={ActivityLeft}>
                        <span style={ActivityKind}>{t.operationType}</span>
                        <span style={ActivityWhen}>{fmtDate(t.timestamp)}</span>
                      </div>
                      <span style={{
                        ...ActivityAmount,
                        color: Number(t.amount) >= 0 ? '#059669' : '#dc2626',
                      }}>
                        {fmtEur(t.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'modelos' && <MasterModelosPanel />}

        {activeTab === 'historial' && (
          <div style={TabPlaceholder}>
            <p>{i18n.t('masterDashboard.placeholders.historial')}</p>
          </div>
        )}

        {activeTab === 'payout' && (
          <div style={TabPlaceholder}>
            <p>{i18n.t('masterDashboard.placeholders.payout')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
