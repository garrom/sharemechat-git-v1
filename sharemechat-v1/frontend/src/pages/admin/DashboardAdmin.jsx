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
import AdminModerationPanel from './AdminModerationPanel';
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
      title: 'Content CMS',
      subtitle: 'Gestion editorial de articulos. Fase 1: borrador en backoffice, sin publicacion publica, sin IA, sin workflow completo.',
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
      capabilities.canViewModeration ? 'moderation' : null,
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
          capabilities.canViewModeration ? {
            key: 'moderation',
            label: t('admin.shell.sections.business.items.moderation.label'),
            meta: t('admin.shell.sections.business.items.moderation.meta'),
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
            label: 'Content CMS',
            meta: 'Articulos editoriales (Fase 1)',
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
              title="Onboarding y revision de modelos"
              subtitle="Bloque actual de trabajo para verificacion y seguimiento de modelos. El alcance todavia no cubre una gestion general de usuarios."
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

          {activeView === 'moderation' && capabilities.canViewModeration && (
            <AdminPage
              title={t('admin.moderation.wrapper.title')}
              subtitle={t('admin.moderation.wrapper.subtitle')}
            >
              <AdminModerationPanel canReview={capabilities.canReviewModeration} />
            </AdminPage>
          )}

          {activeView === 'finance' && capabilities.canViewFinance && (
            <AdminPage
              title="Resumen financiero"
              subtitle="Visibilidad principal de facturacion, margen y ranking economico."
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
              title="Ajustes financieros manuales"
              subtitle="Bloque inicial separado para operaciones sensibles. Actualmente se centra en refunds manuales."
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
              title="Control interno"
              subtitle="Checks de consistencia, integridad y auditoria interna del sistema."
            >
              <AdminAuditPanel />
            </AdminPage>
          )}

          {activeView === 'data' && capabilities.canViewDb && (
            <AdminPage
              title="Datos internos"
              subtitle="Consultas internas operativas para investigacion y una capa raw tecnica reservada a administracion."
            >
              <AdminDataPanel />
            </AdminPage>
          )}

          {activeView === 'administration' && capabilities.canViewAdministration && (
            <AdminPage
              title="Administracion interna"
              subtitle="Vista MVP de usuarios con acceso backoffice, roles efectivos, permisos visibles y overrides."
            >
              <AdminAdministrationPanel />
            </AdminPage>
          )}

          {activeView === 'content' && capabilities.canViewContent && (
            <AdminPage
              title="Content CMS"
              subtitle="Articulos editoriales en backoffice. Fase 1: solo borrador (estado IDEA), sin IA, sin publicacion publica, sin workflow completo."
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
