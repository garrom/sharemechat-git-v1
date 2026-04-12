import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
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

const VIEW_COPY = {
  overview: {
    title: 'Overview',
    subtitle: 'Portada operativa con estado general, prioridades visibles y accesos directos al trabajo diario.',
  },
  operations: {
    title: 'Operaciones',
    subtitle: 'Estado operativo actual del runtime y seguimiento de sesiones activas.',
  },
  models: {
    title: 'Modelos',
    subtitle: 'Onboarding, verificacion y revision de modelos con el flujo operativo actual.',
  },
  moderation: {
    title: 'Moderacion',
    subtitle: 'Revision de reports y gestion de incidencias abiertas.',
  },
  finance: {
    title: 'Finanzas',
    subtitle: 'Resumen economico principal y ranking agregado reutilizando los datos actuales.',
  },
  'finance-adjustments': {
    title: 'Ajustes financieros',
    subtitle: 'Operaciones manuales sensibles. En esta fase se limita a refunds manuales.',
  },
  control: {
    title: 'Control interno',
    subtitle: 'Comprobaciones de consistencia y auditoria interna del sistema actual.',
  },
  data: {
    title: 'Datos internos',
    subtitle: 'Consultas internas de soporte y acceso tecnico controlado.',
  },
  administration: {
    title: 'Administracion',
    subtitle: 'Base preparada para la futura gestion de usuarios internos, roles y permisos.',
  },
  profile: {
    title: 'PerfilBackoffice',
    subtitle: 'Datos basicos de tu cuenta autenticada y cambio de contrasena propio.',
  },
};

const actionButtonStyle = {
  padding: '10px 14px',
  borderRadius: 12,
  fontSize: 13,
  fontWeight: 700,
};

const DashboardAdmin = () => {
  const { user, loading } = useSession();
  const [activeView, setActiveView] = useState('overview');
  const [resendingVerification, setResendingVerification] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const history = useHistory();

  const adminView = isBackofficeAdmin(user);
  const supportView = isBackofficeSupport(user);
  const auditView = isBackofficeAudit(user);
  const emailVerificationBlocked = !!user && !user?.emailVerifiedAt;

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
      setVerificationMessage('Te hemos reenviado el email de validacion.');
    } catch (e) {
      setVerificationError(e?.data?.message || 'No se pudo reenviar el email de validacion.');
    } finally {
      setResendingVerification(false);
    }
  };

  const displayName = user?.name || user?.nickname || user?.email || 'Backoffice';
  const displayRole = adminView ? 'ADMIN' : supportView ? 'SUPPORT' : auditView ? 'AUDIT' : 'UNKNOWN';

  const navigationSections = useMemo(() => {
    const sections = [
      {
        label: 'Principal',
        items: [
          {
            key: 'overview',
            label: 'Overview',
            meta: 'Portada operativa y accesos rapidos.',
          },
          (capabilities.canViewStats || capabilities.canViewStreams) ? {
            key: 'operations',
            label: 'Operaciones',
            meta: 'Runtime, sesiones en curso y actividad realtime.',
          } : null,
        ].filter(Boolean),
      },
      {
        label: 'Operacion de negocio',
        items: [
          capabilities.canViewModels ? {
            key: 'models',
            label: 'Modelos',
            meta: 'Onboarding, verificacion y revision de modelos.',
          } : null,
          capabilities.canViewModeration ? {
            key: 'moderation',
            label: 'Moderacion',
            meta: 'Reports, estados y decisiones operativas.',
          } : null,
          capabilities.canViewFinance ? {
            key: 'finance',
            label: 'Finanzas',
            meta: 'Resumen economico y rendimiento principal.',
          } : null,
          capabilities.canRefund ? {
            key: 'finance-adjustments',
            label: 'Ajustes financieros',
            meta: 'Refunds manuales y operaciones sensibles.',
          } : null,
        ].filter(Boolean),
      },
      {
        label: 'Control y administracion',
        items: [
          capabilities.canViewAudit ? {
            key: 'control',
            label: 'Control interno',
            meta: 'Auditoria y comprobaciones de consistencia.',
          } : null,
          capabilities.canViewDb ? {
            key: 'data',
            label: 'Datos internos',
            meta: 'Consultas internas y acceso tecnico controlado.',
          } : null,
          capabilities.canViewAdministration ? {
            key: 'administration',
            label: 'Administracion',
            meta: 'Base preparada para usuarios y permisos de backoffice.',
          } : null,
        ].filter(Boolean),
      },
    ];

    return sections.filter((section) => section.items.length > 0);
  }, [capabilities]);

  const currentView = VIEW_COPY[activeView] || VIEW_COPY.overview;

  return (
    <AdminLayout
      title={emailVerificationBlocked ? 'Validacion de email pendiente' : currentView.title}
      subtitle={emailVerificationBlocked ? 'Tu acceso queda restringido hasta que confirmes el email de la cuenta interna.' : currentView.subtitle}
      activeKey={emailVerificationBlocked ? 'verification' : activeView}
      onSelect={setActiveView}
      sections={emailVerificationBlocked ? [] : navigationSections}
      footerLabel="Sesion activa"
      footerValue={`${displayName} - ${displayRole}`}
      onLogout={handleLogout}
      meta={emailVerificationBlocked
        ? [
            { label: 'Rol', value: displayRole },
            { label: 'Email', value: 'PENDIENTE' },
          ]
        : [
            { label: 'Rol', value: displayRole },
            { label: 'Surface', value: 'BACKOFFICE' },
          ]}
      topbarActions={emailVerificationBlocked
        ? []
        : [
            {
              key: 'profile',
              label: 'Perfil',
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
              Acceso restringido
            </div>
            <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700, color: '#4a2b00' }}>
              Debes validar tu email antes de continuar en el backoffice.
            </div>
            <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
              Hasta entonces solo puedes reenviar la validacion o cerrar sesion.
            </div>
          </div>

          <AdminPage
            title="Cuenta pendiente de validacion"
            subtitle="La interfaz interna queda bloqueada hasta que confirmes el email asociado a esta cuenta."
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
                  {resendingVerification ? 'Reenviando...' : 'Reenviar validacion'}
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
                  Cerrar sesion
                </button>
              </div>
            )}
          >
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ color: '#40506a', lineHeight: 1.6 }}>
                Has iniciado sesion como <strong>{displayName}</strong>{user?.email ? ` (${user.email})` : ''}, pero la cuenta interna todavia no tiene el email validado.
              </div>
              <div style={{ color: '#40506a', lineHeight: 1.6 }}>
                Cuando completes la validacion, vuelve a entrar en el backoffice para recuperar el acceso normal a overview, moderacion, finanzas y el resto de modulos internos.
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
                  title="Resumen operativo"
                  subtitle="Lectura rapida del estado actual del runtime y de las colas activas."
                >
                  <AdminStatsPanel />
                </AdminPage>
              )}

              {capabilities.canViewStreams && (
                <AdminPage
                  muted
                  title="Sesiones activas"
                  subtitle="Detalle operativo de streams activos con capacidad de inspeccion y corte manual."
                >
                  <AdminActiveStreamsPanel canKill={capabilities.canKillStreams} />
                </AdminPage>
              )}

              {!capabilities.canViewStats && !capabilities.canViewStreams && (
                <AdminPlaceholderPanel
                  title="Operaciones no disponible"
                  body="Tu perfil actual no tiene acceso a los bloques operativos de runtime."
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
              title="Casos de moderacion"
              subtitle="Revision de reports y decision operativa sobre incidencias abiertas."
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

          {activeView === 'profile' && (
            <AdminPage
              title="Cuenta del Backoffice"
              subtitle="Informacion basica de la cuenta autenticada y cambio de contrasena propio."
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
