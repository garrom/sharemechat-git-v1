// src/pages/admin/AdminAuditPanel.jsx
import React, { useState } from 'react';
import styled from 'styled-components';
import i18n from '../../i18n';
import { SectionTitle, TabsBar, SmallBtn } from '../../styles/AdminStyles';
import AuditAccountingPanel from './audit/AuditAccountingPanel';
import AuditSessionIntegrityPanel from './audit/AuditSessionIntegrityPanel';
import AuditRuntimeHealthPanel from './audit/AuditRuntimeHealthPanel';
import AuditIncidentPanel from './audit/AuditIncidentPanel';

const PanelTabButton = styled(SmallBtn)`
  padding: 6px 10px;
  border: 1px solid ${({ $active }) => ($active ? '#c7d4e2' : '#465568')};
  background: ${({ $active }) => ($active ? '#eef4fb' : '#334255')};
  color: ${({ $active }) => ($active ? '#18212f' : '#eef3f8')};
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;

  &:hover:not(:disabled) {
    background: ${({ $active }) => ($active ? '#eef4fb' : '#e6eef8')};
    border-color: ${({ $active }) => ($active ? '#c7d4e2' : '#c1cfde')};
    color: #18212f;
  }
`;

const AdminAuditPanel = () => {
  const t = (key, options) => i18n.t(key, options);
  const [activeAuditTab, setActiveAuditTab] = useState('accounting');

  return (
    <div>
      <SectionTitle>{t('admin.audit.panel.title')}</SectionTitle>

      <TabsBar>
        <PanelTabButton
          type="button"
          onClick={() => setActiveAuditTab('accounting')}
          $active={activeAuditTab === 'accounting'}
        >
          {t('admin.audit.tabs.accounting')}
        </PanelTabButton>

        <PanelTabButton
          type="button"
          onClick={() => setActiveAuditTab('session-integrity')}
          $active={activeAuditTab === 'session-integrity'}
        >
          {t('admin.audit.tabs.sessionIntegrity')}
        </PanelTabButton>

        <PanelTabButton
          type="button"
          onClick={() => setActiveAuditTab('runtime-health')}
          $active={activeAuditTab === 'runtime-health'}
        >
          {t('admin.audit.tabs.runtimeHealth')}
        </PanelTabButton>

        <PanelTabButton
          type="button"
          onClick={() => setActiveAuditTab('incidents')}
          $active={activeAuditTab === 'incidents'}
        >
          {t('admin.audit.tabs.incidents')}
        </PanelTabButton>
      </TabsBar>

      {activeAuditTab === 'accounting' && <AuditAccountingPanel />}
      {activeAuditTab === 'session-integrity' && <AuditSessionIntegrityPanel />}
      {activeAuditTab === 'runtime-health' && <AuditRuntimeHealthPanel />}
      {activeAuditTab === 'incidents' && <AuditIncidentPanel />}
    </div>
  );
};

export default AdminAuditPanel;
