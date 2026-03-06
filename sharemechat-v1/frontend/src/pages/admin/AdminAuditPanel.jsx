// src/pages/admin/AdminAuditPanel.jsx
import React, { useState } from 'react';
import { SectionTitle, TabsBar, TabButton } from '../../styles/AdminStyles';
import AuditAccountingPanel from './audit/AuditAccountingPanel';
import AuditSessionIntegrityPanel from './audit/AuditSessionIntegrityPanel';
import AuditRuntimeHealthPanel from './audit/AuditRuntimeHealthPanel';
import AuditIncidentPanel from './audit/AuditIncidentPanel';

const AdminAuditPanel = () => {
  const [activeAuditTab, setActiveAuditTab] = useState('accounting');

  return (
    <div>
      <SectionTitle>Auditoría</SectionTitle>

      <TabsBar>
        <TabButton
          active={activeAuditTab === 'accounting'}
          onClick={() => setActiveAuditTab('accounting')}
        >
          Accounting
        </TabButton>

        <TabButton
          active={activeAuditTab === 'session-integrity'}
          onClick={() => setActiveAuditTab('session-integrity')}
        >
          Session Integrity
        </TabButton>

        <TabButton
          active={activeAuditTab === 'runtime-health'}
          onClick={() => setActiveAuditTab('runtime-health')}
        >
          Runtime Health
        </TabButton>

        <TabButton
          active={activeAuditTab === 'incidents'}
          onClick={() => setActiveAuditTab('incidents')}
        >
          Incidents
        </TabButton>
      </TabsBar>

      {activeAuditTab === 'accounting' && <AuditAccountingPanel />}
      {activeAuditTab === 'session-integrity' && <AuditSessionIntegrityPanel />}
      {activeAuditTab === 'runtime-health' && <AuditRuntimeHealthPanel />}
      {activeAuditTab === 'incidents' && <AuditIncidentPanel />}
    </div>
  );
};

export default AdminAuditPanel;