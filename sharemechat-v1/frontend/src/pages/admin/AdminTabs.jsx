import React from 'react';
import { TabButton, TabsBar } from '../../styles/AdminStyles';

const AdminTabs = ({ activeTab, setActiveTab }) => {
  return (
    <TabsBar>
      <TabButton active={activeTab === 'models'} onClick={() => setActiveTab('models')}>Gestión Modelos</TabButton>
      <TabButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')}>Estadísticas</TabButton>
      <TabButton active={activeTab === 'finance'} onClick={() => setActiveTab('finance')}>Análisis Financiero</TabButton>
      <TabButton active={activeTab === 'db'} onClick={() => setActiveTab('db')}>Vista BBDD</TabButton>
      <TabButton active={activeTab === 'audit'} onClick={() => setActiveTab('audit')}>Auditoría</TabButton>
      <TabButton active={activeTab === 'moderation'} onClick={() => setActiveTab('moderation')}>Moderación</TabButton>
      <TabButton active={activeTab === 'streams'} onClick={() => setActiveTab('streams')}>Streams activos</TabButton>
    </TabsBar>
  );
};

export default AdminTabs;
