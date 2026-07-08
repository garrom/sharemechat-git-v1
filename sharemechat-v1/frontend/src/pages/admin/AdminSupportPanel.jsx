import React, { useState } from 'react';
import styled from 'styled-components';
import i18n from '../../i18n';
import { TabsBar, TabButton } from '../../styles/AdminStyles';
import SupportConversationsListView from './support/SupportConversationsListView';
import SupportConversationDetailView from './support/SupportConversationDetailView';
import AdminSupportProfilesView from './support/AdminSupportProfilesView';

// Frente B.3.2 (ADR-046). Contenedor del panel humano. Sub-tabs:
// - conversations: chat_handle requerido.
// - profiles: profile_manage requerido.
// El gating fino se hace por prop desde DashboardAdmin (canHandle, canManage).

const Wrap = styled.div`
  padding: 4px 0 8px;
`;

const AdminSupportPanel = ({
  canHandle = false,
  canManage = false,
  currentUserEmail = '',
  onRefreshBadge,
}) => {
  const t = (key, opts) => i18n.t(key, opts);
  const defaultTab = canHandle ? 'conversations' : (canManage ? 'profiles' : 'conversations');
  const [subTab, setSubTab] = useState(defaultTab);
  const [detailId, setDetailId] = useState(null);

  const handleActionRefresh = () => {
    if (typeof onRefreshBadge === 'function') onRefreshBadge();
  };

  return (
    <Wrap>
      <TabsBar>
        {canHandle ? (
          <TabButton
            active={subTab === 'conversations'}
            onClick={() => { setSubTab('conversations'); setDetailId(null); }}
          >
            {t('admin.support.tabs.conversations')}
          </TabButton>
        ) : null}
        {canManage ? (
          <TabButton
            active={subTab === 'profiles'}
            onClick={() => { setSubTab('profiles'); setDetailId(null); }}
          >
            {t('admin.support.tabs.profiles')}
          </TabButton>
        ) : null}
      </TabsBar>

      {subTab === 'conversations' && canHandle ? (
        detailId ? (
          <SupportConversationDetailView
            conversationId={detailId}
            onBack={() => setDetailId(null)}
            onActionRefresh={handleActionRefresh}
          />
        ) : (
          <SupportConversationsListView
            onOpenDetail={(id) => setDetailId(id)}
          />
        )
      ) : null}

      {subTab === 'profiles' && canManage ? (
        <AdminSupportProfilesView currentUserEmail={currentUserEmail} />
      ) : null}
    </Wrap>
  );
};

export default AdminSupportPanel;
