import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import i18n from '../../i18n';
import { apiFetch } from '../../config/http';
import { useSession } from '../../components/SessionProvider';
import AdminActiveStreamsPanel from './AdminActiveStreamsPanel';
import AdminAdministrationPanel from './AdminAdministrationPanel';
import AdminAuditPanel from './AdminAuditPanel';
import AdminDataPanel from './AdminDataPanel';
import AdminFinancePanel from './AdminFinancePanel';
import AdminModelsPanel from './AdminModelsPanel';
import AdminAssetModerationPanel from './AdminAssetModerationPanel';
import AdminModerationPanel from './AdminModerationPanel';
import AdminComplaintsPanel from './AdminComplaintsPanel';
import AdminStreamModerationPanel from './AdminStreamModerationPanel';
import AdminOverviewPanel from './AdminOverviewPanel';
import AdminProfilePage from './AdminProfilePage';
import AdminStatsPanel from './AdminStatsPanel';
import AdminContentPanel from './content/AdminContentPanel';
import AdminLayout from './components/AdminLayout';
import AdminPage from './components/AdminPage';
import AdminPlaceholderPanel from './components/AdminPlaceholderPanel';
import {
  canAccessBackoffice,
  hasBackofficePermission,
  isBackofficeAdmin,
  isBackofficeAudit,
  isBackofficeSupport,
} from '../../utils/backofficeAccess';
import { navigateToUrl, resolveHomeUrl } from '../../utils/runtimeSurface';

const actionButtonStyle = {
  padding: '10px 14px',
  borderRadius: 12,
  fontSize: 13,
  fontWeight: 700,
};

const DashboardAdmin = () => {
  const { user, loading } = useSession();
  const t = (key, options) => i18n.t(key, options);
  const [activeView, setActiveView] = useState('overview');
  const [resendingVerification, setResendingVerification] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const history = useHistory();

  const adminView = isBackofficeAdmin(user);
  const supportView = isBackofficeSupport(user);
  const auditView = isBackofficeAudit(user);
  const emailVerificationBlocked = !!user && !user?.emailVerifiedAt;
  const viewCopy = {
    overview: {
      title: t('admin.shell.views.overview.title'),
      subtitle: t('admin.shell.views.overview.subtitle'),
    },
    operations: {
      title: t('admin.shell.views.operations.title'),
      subtitle: t('admin.shell.views.operations.subtitle'),
    },
    models: {
      title: t('admin.shell.views.models.title'),
      subtitle: t('admin.shell.views.models.subtitle'),
    },
    'asset-moderation': {
      title: t('admin.dashboard.pageTitles.assetModeration'),
      subtitle: t('admin.dashboard.viewCopy.assetModeration.subtitle'),
    },
    'stream-moderation': {
      title: t('admin.streamModeration.title'),
      subtitle: t('admin.streamModeration.subtitle'),
    },
    moderation: {
      title: t('admin.shell.views.moderation.title'),
      subtitle: t('admin.shell.views.moderation.subtitle'),
    },
    finance: {
      title: t('admin.shell.views.finance.title'),
      subtitle: t('admin.shell.views.finance.subtitle'),
    },
    'finance-adjustments': {
      title: t('admin.shell.views.financeAdjustments.title'),
      subtitle: t('admin.shell.views.financeAdjustments.subtitle'),
    },
    control: {
      title: t('admin.shell.views.control.title'),
      subtitle: t('admin.shell.views.control.subtitle'),
    },
    data: {
      title: t('admin.shell.views.data.title'),
      subtitle: t('admin.shell.views.data.subtitle'),
    },
    administration: {
      title: t('admin.shell.views.administration.title'),
      subtitle: t('admin.shell.views.administration.subtitle'),
    },
    content: {
      title: t('admin.dashboard.pageTitles.content'),
      subtitle: t('admin.dashboard.viewCopy.content.subtitle'),
    },
    profile: {
      title: t('admin.shell.views.profile.title'),
      subtitle: t('admin.shell.views.profile.subtitle'),
    },
  };

  const capabilities = useMemo(() => ({
    canViewModels: adminView || hasBackofficePermission(user, 'models.read_list'),
    canReadKycMode: adminView || hasBackofficePermission(user, 'models.read_kyc_mode'),
    canUpdateChecklist: adminView || hasBackofficePermission(user, 'models.update_checklist'),
    canReviewModels: adminView,
    canChangeKycMode: adminView,
    canViewSensitiveDocs: adminView,
    canViewAssetModeration: adminView || supportView || auditView,
    canModerateAssets: adminView || supportView,
    // Fase 9: rechazo retroactivo de APPROVED es exclusivo de ADMIN
    canRejectApprovedAssets: adminView,
    // Frente Moderacion IA del streaming (ADR-030 / ADR-036 / ADR-037).
    // Decision K5: lectura ADMIN + SUPPORT + AUDIT; moderacion ADMIN +
    // SUPPORT; cambio de config ADMIN solo. Gating fino vive en backend
    // (segunda barrera del controller); aqui solo se decide visibilidad
    // del panel + habilitacion de botones.
    canViewStreamModeration: adminView || supportView || auditView,
    canModerateStream: adminView || supportView,
    canChangeStreamModerationConfig: adminView,
    canViewStats: adminView || hasBackofficePermission(user, 'stats.read_overview'),
    canViewFinance: adminView
      || (
        hasBackofficePermission(user, 'finance.read_summary')
        && hasBackofficePermission(user, 'finance.read_top_models')
        && hasBackofficePermission(user, 'finance.read_top_clients')
      ),
    canRefund: adminView,
    canViewModeration: adminView || hasBackofficePermission(user, 'moderation.read_reports'),
    canReviewModeration: adminView,
    canViewComplaints: adminView || hasBackofficePermission(user, 'complaints.read_list'),
    canReviewComplaints: adminView || hasBackofficePermission(user, 'complaints.review'),
    canViewStreams: adminView || hasBackofficePermission(user, 'streams.read_active'),
    canKillStreams: adminView,
    canViewDb: adminView,
    canViewAudit: adminView,
    canViewAdministration: adminView,
    canViewContent: adminView || hasBackofficePermission(user, 'CONTENT.VIEW'),
  }), [adminView, user]);

  useEffect(() => {
    if (loading) return;
    if (!canAccessBackoffice(user)) {
      navigateToUrl(user ? resolveHomeUrl(user) : '/login', history, { replace: true });
    }
  }, [history, loading, user]);

  useEffect(() => {
    if (loading || emailVerificationBlocked) return;

    const allowedViews = [
      'overview',
      capabilities.canViewStats || capabilities.canViewStreams ? 'operations' : null,
      capabilities.canViewModels ? 'models' : null,
      capabilities.canViewAssetModeration ? 'asset-moderation' : null,
      capabilities.canViewStreamModeration ? 'stream-moderation' : null,
      capabilities.canViewModeration ? 'moderation' : null,
      capabilities.canViewComplaints ? 'complaints' : null,
      capabilities.canViewFinance ? 'finance' : null,
      capabilities.canRefund ? 'finance-adjustments' : null,
      capabilities.canViewAudit ? 'control' : null,
      capabilities.canViewDb ? 'data' : null,
      capabilities.canViewAdministration ? 'administration' : null,
      capabilities.canViewContent ? 'content' : null,
      'profile',
    ].filter(Boolean);

    if (!allowedViews.includes(activeView)) {
      setActiveView(allowedViews[0] || 'overview');
    }
  }, [activeView, capabilities, emailVerificationBlocked, loading]);

  const handleLogout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      /* noop */
    }
    history.push('/login');
  };

  const handleResendVerification = async () => {
    if (resendingVerification) return;

    setResendingVerification(true);
    setVerificationMessage('');
    setVerificationError('');

    try {
      await apiFetch('/email-verification/resend', { method: 'POST' });
      setVerificationMessage(t('admin.shell.restricted.success'));
    } catch {
      setVerificationError(t('admin.shell.restricted.error'));
    } finally {
      setResendingVerification(false);
    }
  };

  const displayName = user?.name || user?.nickname || user?.email || t('admin.shell.userFallback');
  const displayRole = adminView ? 'ADMIN' : supportView ? 'SUPPORT' : auditView ? 'AUDIT' : 'UNKNOWN';

  const navigationSections = useMemo(() => {
    const sections = [
      {
        label: t('admin.shell.sections.primary.label'),
        items: [
          {
            key: 'overview',
            label: t('admin.shell.sections.primary.items.overview.label'),
            meta: t('admin.shell.sections.primary.items.overview.meta'),
          },
          (capabilities.canViewStats || capabilities.canViewStreams) ? {
            key: 'operations',
            label: t('admin.shell.sections.primary.items.operations.label'),
            meta: t('admin.shell.sections.primary.items.operations.meta'),
          } : null,
        ].filter(Boolean),
      },
      {
        label: t('admin.shell.sections.business.label'),
        items: [
          capabilities.canViewModels ? {
            key: 'models',
            label: t('admin.shell.sections.business.items.models.label'),
            meta: t('admin.shell.sections.business.items.models.meta'),
          } : null,
          capabilities.canViewAssetModeration ? {
            key: 'asset-moderation',
            label: t('admin.dashboard.sidebar.assetModeration.label'),
            meta: t('admin.dashboard.sidebar.assetModeration.meta'),
          } : null,
          capabilities.canViewStreamModeration ? {
            key: 'stream-moderation',
            label: t('admin.streamModeration.title'),
            meta: t('admin.streamModeration.subtitle'),
          } : null,
          capabilities.canViewModeration ? {
            key: 'moderation',
            label: t('admin.shell.sections.business.items.moderation.label'),
            meta: t('admin.shell.sections.business.items.moderation.meta'),
          } : null,
          capabilities.canViewComplaints ? {
            key: 'complaints',
            label: t('admin.complaints.title', { defaultValue: 'Complaints' }),
            meta: t('admin.complaints.subtitle', { defaultValue: 'Public complaints with SLA tracking' }),
          } : null,
          capabilities.canViewFinance ? {
            key: 'finance',
            label: t('admin.shell.sections.business.items.finance.label'),
            meta: t('admin.shell.sections.business.items.finance.meta'),
          } : null,
          capabilities.canRefund ? {
            key: 'finance-adjustments',
            label: t('admin.shell.sections.business.items.financeAdjustments.label'),
            meta: t('admin.shell.sections.business.items.financeAdjustments.meta'),
          } : null,
        ].filter(Boolean),
      },
      {
        label: t('admin.shell.sections.control.label'),
        items: [
          capabilities.canViewAudit ? {
            key: 'control',
            label: t('admin.shell.sections.control.items.control.label'),
            meta: t('admin.shell.sections.control.items.control.meta'),
          } : null,
          capabilities.canViewDb ? {
            key: 'data',
            label: t('admin.shell.sections.control.items.data.label'),
            meta: t('admin.shell.sections.control.items.data.meta'),
          } : null,
          capabilities.canViewAdministration ? {
            key: 'administration',
            label: t('admin.shell.sections.control.items.administration.label'),
            meta: t('admin.shell.sections.control.items.administration.meta'),
          } : null,
          capabilities.canViewContent ? {
            key: 'content',
            label: t('admin.dashboard.sidebar.content.label'),
            meta: t('admin.dashboard.sidebar.content.meta'),
          } : null,
        ].filter(Boolean),
      },
    ];

    return sections.filter((section) => section.items.length > 0);
  }, [capabilities, t]);

  const currentView = viewCopy[activeView] || viewCopy.overview;

  return (
    <AdminLayout
      title={emailVerificationBlocked ? t('admin.shell.restricted.topbarTitle') : currentView.title}
      subtitle={emailVerificationBlocked ? t('admin.shell.restricted.topbarSubtitle') : currentView.subtitle}
      eyebrow={t('admin.shell.topbar.eyebrow')}
      brandEyebrow={t('admin.shell.brand.eyebrow')}
      brandTitle={t('admin.shell.brand.title')}
      brandSubtitle={t('admin.shell.brand.subtitle')}
      activeKey={emailVerificationBlocked ? 'verification' : activeView}
      onSelect={setActiveView}
      sections={emailVerificationBlocked ? [] : navigationSections}
      footerLabel={t('admin.shell.footer.activeSession')}
      footerLogoutLabel={t('admin.shell.footer.logout')}
      footerValue={`${displayName} - ${displayRole}`}
      onLogout={handleLogout}
      meta={emailVerificationBlocked
        ? [
            { label: t('admin.shell.meta.role'), value: displayRole },
            { label: t('admin.shell.meta.email'), value: t('admin.shell.meta.pending') },
          ]
        : [
            { label: t('admin.shell.meta.role'), value: displayRole },
            { label: t('admin.shell.meta.surface'), value: t('admin.shell.meta.surfaceValue') },
          ]}
      topbarActions={emailVerificationBlocked
        ? []
        : [
            {
              key: 'profile',
              label: t('admin.shell.actions.profile'),
              active: activeView === 'profile',
              onClick: () => setActiveView('profile'),
            },
          ]}
    >
      {emailVerificationBlocked ? (
        <>
          <div
            style={{
              margin: '24px 24px 0',
              borderRadius: 18,
              border: '1px solid #f2cf95',
              background: 'linear-gradient(180deg, #fff7e8 0%, #fff2d7 100%)',
              padding: '18px 20px',
              color: '#7a4b00',
              boxShadow: '0 12px 28px rgba(122, 75, 0, 0.08)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {t('admin.shell.restricted.badge')}
            </div>
            <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700, color: '#4a2b00' }}>
              {t('admin.shell.restricted.title')}
            </div>
            <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
              {t('admin.shell.restricted.body')}
            </div>
          </div>

          <AdminPage
            title={t('admin.shell.restricted.pageTitle')}
            subtitle={t('admin.shell.restricted.pageSubtitle')}
            actions={(
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendingVerification}
                  style={{
                    ...actionButtonStyle,
                    border: '1px solid #d8b375',
                    background: '#f6d9a7',
                    color: '#4a2b00',
                    cursor: resendingVerification ? 'default' : 'pointer',
                    opacity: resendingVerification ? 0.7 : 1,
                  }}
                >
                  {resendingVerification ? t('admin.shell.restricted.resending') : t('admin.shell.restricted.resend')}
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    ...actionButtonStyle,
                    border: '1px solid #d2d8e5',
                    background: '#fff',
                    color: '#24324a',
                    cursor: 'pointer',
                  }}
                >
                  {t('admin.shell.footer.logout')}
                </button>
              </div>
            )}
          >
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ color: '#40506a', lineHeight: 1.6 }}>
                {t('admin.shell.restricted.signedInAs', {
                  displayName,
                  email: user?.email ? ` (${user.email})` : '',
                })}
              </div>
              <div style={{ color: '#40506a', lineHeight: 1.6 }}>
                {t('admin.shell.restricted.recoveryHint')}
              </div>
              {verificationMessage ? (
                <div style={{ padding: '12px 14px', borderRadius: 14, border: '1px solid #bfe9ca', background: '#ecfbf0', color: '#166534', lineHeight: 1.5 }}>
                  {verificationMessage}
                </div>
              ) : null}
              {verificationError ? (
                <div style={{ padding: '12px 14px', borderRadius: 14, border: '1px solid #f1c4bf', background: '#fff1f0', color: '#b42318', lineHeight: 1.5 }}>
                  {verificationError}
                </div>
              ) : null}
            </div>
          </AdminPage>
        </>
      ) : (
        <>
          {activeView === 'overview' && (
            <AdminOverviewPanel
              capabilities={capabilities}
              onOpen={setActiveView}
            />
          )}

          {activeView === 'operations' && (
            <>
              {capabilities.canViewStats && (
                <AdminPage
                  title={t('admin.streams.wrapper.statsTitle')}
                  subtitle={t('admin.streams.wrapper.statsSubtitle')}
                >
                  <AdminStatsPanel />
                </AdminPage>
              )}

              {capabilities.canViewStreams && (
                <AdminPage
                  muted
                  title={t('admin.streams.wrapper.title')}
                  subtitle={t('admin.streams.wrapper.subtitle')}
                >
                  <AdminActiveStreamsPanel canKill={capabilities.canKillStreams} />
                </AdminPage>
              )}

              {!capabilities.canViewStats && !capabilities.canViewStreams && (
                <AdminPlaceholderPanel
                  title={t('admin.streams.wrapper.unavailableTitle')}
                  body={t('admin.streams.wrapper.unavailableBody')}
                />
              )}
            </>
          )}

          {activeView === 'models' && capabilities.canViewModels && (
            <AdminPage
              title={t('admin.dashboard.pageTitles.models')}
              subtitle={t('admin.dashboard.pageSubtitles.models')}
            >
              <AdminModelsPanel
                canReadKycMode={capabilities.canReadKycMode}
                canUpdateChecklist={capabilities.canUpdateChecklist}
                canReviewModels={capabilities.canReviewModels}
                canChangeKycMode={capabilities.canChangeKycMode}
                canViewSensitiveDocs={capabilities.canViewSensitiveDocs}
              />
            </AdminPage>
          )}

          {activeView === 'asset-moderation' && capabilities.canViewAssetModeration && (
            <AdminPage
              title={t('admin.dashboard.pageTitles.assetModeration')}
              subtitle={t('admin.dashboard.pageSubtitles.assetModeration')}
            >
              <AdminAssetModerationPanel
                canModerate={capabilities.canModerateAssets}
                canRejectApproved={capabilities.canRejectApprovedAssets}
              />
            </AdminPage>
          )}

          {activeView === 'stream-moderation' && capabilities.canViewStreamModeration && (
            <AdminPage
              title={t('admin.streamModeration.title')}
              subtitle={t('admin.streamModeration.subtitle')}
            >
              <AdminStreamModerationPanel
                canModerate={capabilities.canModerateStream}
                canChangeConfig={capabilities.canChangeStreamModerationConfig}
              />
            </AdminPage>
          )}

          {activeView === 'moderation' && capabilities.canViewModeration && (
            <AdminPage
              title={t('admin.moderation.wrapper.title')}
              subtitle={t('admin.moderation.wrapper.subtitle')}
            >
              <AdminModerationPanel canReview={capabilities.canReviewModeration} />
            </AdminPage>
          )}

          {activeView === 'complaints' && capabilities.canViewComplaints && (
            <AdminPage
              title={t('admin.complaints.title', { defaultValue: 'Complaints' })}
              subtitle={t('admin.complaints.subtitle', { defaultValue: 'Public complaints with SLA tracking' })}
            >
              <AdminComplaintsPanel canReview={capabilities.canReviewComplaints} />
            </AdminPage>
          )}

          {activeView === 'finance' && capabilities.canViewFinance && (
            <AdminPage
              title={t('admin.dashboard.pageTitles.finance')}
              subtitle={t('admin.dashboard.pageSubtitles.finance')}
            >
              <AdminFinancePanel
                canRefund={false}
                showSummary
                showRefunds={false}
              />
            </AdminPage>
          )}

          {activeView === 'finance-adjustments' && capabilities.canRefund && (
            <AdminPage
              title={t('admin.dashboard.pageTitles.financeAdjustments')}
              subtitle={t('admin.dashboard.pageSubtitles.financeAdjustments')}
            >
              <AdminFinancePanel
                canRefund={capabilities.canRefund}
                showSummary={false}
                showRefunds
              />
            </AdminPage>
          )}

          {activeView === 'control' && capabilities.canViewAudit && (
            <AdminPage
              title={t('admin.shell.views.control.title')}
              subtitle={t('admin.dashboard.pageSubtitles.control')}
            >
              <AdminAuditPanel />
            </AdminPage>
          )}

          {activeView === 'data' && capabilities.canViewDb && (
            <AdminPage
              title={t('admin.shell.views.data.title')}
              subtitle={t('admin.dashboard.pageSubtitles.data')}
            >
              <AdminDataPanel />
            </AdminPage>
          )}

          {activeView === 'administration' && capabilities.canViewAdministration && (
            <AdminPage
              title={t('admin.dashboard.pageTitles.administration')}
              subtitle={t('admin.dashboard.pageSubtitles.administration')}
            >
              <AdminAdministrationPanel />
            </AdminPage>
          )}

          {activeView === 'content' && capabilities.canViewContent && (
            <AdminPage
              title={t('admin.dashboard.pageTitles.content')}
              subtitle={t('admin.dashboard.pageSubtitles.content')}
            >
              <AdminContentPanel />
            </AdminPage>
          )}

          {activeView === 'profile' && (
            <AdminPage
              title={t('admin.profile.wrapper.title')}
              subtitle={t('admin.profile.wrapper.subtitle')}
            >
              <AdminProfilePage />
            </AdminPage>
          )}
        </>
      )}
    </AdminLayout>
  );
};

export default DashboardAdmin;
