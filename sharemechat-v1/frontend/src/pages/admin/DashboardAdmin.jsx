import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { apiFetch } from '../../config/http';
import { useSession } from '../../components/SessionProvider';
import {
  HeaderBar,
  LogoutButton,
  SectionTitle,
  StyledContainer,
} from '../../styles/AdminStyles';
import AdminActiveStreamsPanel from './AdminActiveStreamsPanel';
import AdminAuditPanel from './AdminAuditPanel';
import AdminDbPanel from './AdminDbPanel';
import AdminFinancePanel from './AdminFinancePanel';
import AdminModelsPanel from './AdminModelsPanel';
import AdminModerationPanel from './AdminModerationPanel';
import AdminStatsPanel from './AdminStatsPanel';
import AdminTabs from './AdminTabs';
import {
  canAccessBackoffice,
  hasBackofficePermission,
  isBackofficeAdmin,
  isBackofficeSupport,
} from '../../utils/backofficeAccess';
import { navigateToUrl, resolveHomeUrl } from '../../utils/runtimeSurface';

const DashboardAdmin = () => {
  const { user, loading } = useSession();
  const [activeTab, setActiveTab] = useState('models');
  const history = useHistory();

  const adminView = isBackofficeAdmin(user);
  const supportView = isBackofficeSupport(user);

  const capabilities = useMemo(() => ({
    canViewModels: adminView || hasBackofficePermission(user, 'models.read_list'),
    canReadKycMode: adminView || hasBackofficePermission(user, 'models.read_kyc_mode'),
    canUpdateChecklist: adminView || hasBackofficePermission(user, 'models.update_checklist'),
    canReviewModels: adminView,
    canChangeKycMode: adminView,
    canViewSensitiveDocs: adminView,
    canViewStats: adminView || hasBackofficePermission(user, 'stats.read_overview'),
    canViewFinance: adminView
      || hasBackofficePermission(user, 'finance.read_summary')
      || hasBackofficePermission(user, 'finance.read_top_models')
      || hasBackofficePermission(user, 'finance.read_top_clients'),
    canRefund: adminView,
    canViewModeration: adminView || hasBackofficePermission(user, 'moderation.read_reports'),
    canReviewModeration: adminView,
    canViewStreams: adminView || hasBackofficePermission(user, 'streams.read_active'),
    canKillStreams: adminView,
    canViewDb: adminView,
    canViewAudit: adminView,
  }), [adminView, user]);

  useEffect(() => {
    if (loading) return;
    if (!canAccessBackoffice(user)) {
      navigateToUrl(user ? resolveHomeUrl(user) : '/login', history, { replace: true });
    }
  }, [history, loading, user]);

  useEffect(() => {
    if (loading) return;

    const allowedTabs = [
      capabilities.canViewModels ? 'models' : null,
      capabilities.canViewStats ? 'stats' : null,
      capabilities.canViewFinance ? 'finance' : null,
      capabilities.canViewDb ? 'db' : null,
      capabilities.canViewAudit ? 'audit' : null,
      capabilities.canViewModeration ? 'moderation' : null,
      capabilities.canViewStreams ? 'streams' : null,
    ].filter(Boolean);

    if (!allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0] || 'models');
    }
  }, [activeTab, capabilities, loading]);

  const handleLogout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      /* noop */
    }
    history.push('/');
  };

  const displayName = user?.name || user?.nickname || user?.email || 'Backoffice';
  const displayRole = adminView ? 'ADMIN' : supportView ? 'SUPPORT' : 'UNKNOWN';

  return (
    <StyledContainer>
      <HeaderBar>
        <h2>Hola, {displayName} (Backoffice: {displayRole})</h2>
        <LogoutButton onClick={handleLogout} title="Cerrar sesiÃ³n">Salir</LogoutButton>
      </HeaderBar>

      <AdminTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        canViewModels={capabilities.canViewModels}
        canViewStats={capabilities.canViewStats}
        canViewFinance={capabilities.canViewFinance}
        canViewDb={capabilities.canViewDb}
        canViewAudit={capabilities.canViewAudit}
        canViewModeration={capabilities.canViewModeration}
        canViewStreams={capabilities.canViewStreams}
      />

      {activeTab === 'models' && capabilities.canViewModels && (
        <AdminModelsPanel
          canReadKycMode={capabilities.canReadKycMode}
          canUpdateChecklist={capabilities.canUpdateChecklist}
          canReviewModels={capabilities.canReviewModels}
          canChangeKycMode={capabilities.canChangeKycMode}
          canViewSensitiveDocs={capabilities.canViewSensitiveDocs}
        />
      )}

      {activeTab === 'stats' && capabilities.canViewStats && <AdminStatsPanel />}

      {activeTab === 'finance' && capabilities.canViewFinance && (
        <AdminFinancePanel canRefund={capabilities.canRefund} />
      )}

      {activeTab === 'db' && capabilities.canViewDb && <AdminDbPanel />}
      {activeTab === 'audit' && capabilities.canViewAudit && <AdminAuditPanel />}

      {activeTab === 'moderation' && capabilities.canViewModeration && (
        <AdminModerationPanel canReview={capabilities.canReviewModeration} />
      )}

      {activeTab === 'streams' && capabilities.canViewStreams && (
        <div>
          <SectionTitle>Streams activos</SectionTitle>
          <AdminActiveStreamsPanel canKill={capabilities.canKillStreams} />
        </div>
      )}
    </StyledContainer>
  );
};

export default DashboardAdmin;
