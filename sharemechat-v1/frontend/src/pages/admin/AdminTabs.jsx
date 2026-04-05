import React from 'react';
import { TabButton, TabsBar } from '../../styles/AdminStyles';

const AdminTabs = ({
  activeTab,
  setActiveTab,
  canViewModels,
  canViewStats,
  canViewFinance,
  canViewDb,
  canViewAudit,
  canViewModeration,
  canViewStreams,
}) => {
  return (
    <TabsBar>
      {canViewModels && <TabButton active={activeTab === 'models'} onClick={() => setActiveTab('models')}>GestiÃ³n Modelos</TabButton>}
      {canViewStats && <TabButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')}>EstadÃ­sticas</TabButton>}
      {canViewFinance && <TabButton active={activeTab === 'finance'} onClick={() => setActiveTab('finance')}>AnÃ¡lisis Financiero</TabButton>}
      {canViewDb && <TabButton active={activeTab === 'db'} onClick={() => setActiveTab('db')}>Vista BBDD</TabButton>}
      {canViewAudit && <TabButton active={activeTab === 'audit'} onClick={() => setActiveTab('audit')}>AuditorÃ­a</TabButton>}
      {canViewModeration && <TabButton active={activeTab === 'moderation'} onClick={() => setActiveTab('moderation')}>ModeraciÃ³n</TabButton>}
      {canViewStreams && <TabButton active={activeTab === 'streams'} onClick={() => setActiveTab('streams')}>Streams activos</TabButton>}
    </TabsBar>
  );
};

export default AdminTabs;
