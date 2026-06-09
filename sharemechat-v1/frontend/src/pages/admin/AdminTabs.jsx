import React from 'react';
import i18n from '../../i18n';
import { TabButton, TabsBar } from '../../styles/AdminStyles';

const AdminTabs = ({
  activeTab,
  setActiveTab,
  canViewModels,
  canViewAssetModeration,
  canViewStats,
  canViewFinance,
  canViewDb,
  canViewAudit,
  canViewModeration,
  canViewStreams,
}) => {
  const t = (key, options) => i18n.t(key, options);
  return (
    <TabsBar>
      {canViewModels && <TabButton active={activeTab === 'models'} onClick={() => setActiveTab('models')}>{t('admin.tabs.models')}</TabButton>}
      {canViewAssetModeration && <TabButton active={activeTab === 'asset-moderation'} onClick={() => setActiveTab('asset-moderation')}>{t('admin.tabs.assetModeration')}</TabButton>}
      {canViewStats && <TabButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')}>{t('admin.tabs.stats')}</TabButton>}
      {canViewFinance && <TabButton active={activeTab === 'finance'} onClick={() => setActiveTab('finance')}>{t('admin.tabs.finance')}</TabButton>}
      {canViewDb && <TabButton active={activeTab === 'db'} onClick={() => setActiveTab('db')}>{t('admin.tabs.db')}</TabButton>}
      {canViewAudit && <TabButton active={activeTab === 'audit'} onClick={() => setActiveTab('audit')}>{t('admin.tabs.audit')}</TabButton>}
      {canViewModeration && <TabButton active={activeTab === 'moderation'} onClick={() => setActiveTab('moderation')}>{t('admin.tabs.moderation')}</TabButton>}
      {canViewStreams && <TabButton active={activeTab === 'streams'} onClick={() => setActiveTab('streams')}>{t('admin.tabs.streams')}</TabButton>}
    </TabsBar>
  );
};

export default AdminTabs;
