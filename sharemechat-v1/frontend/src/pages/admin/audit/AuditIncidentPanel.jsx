// src/pages/admin/audit/AuditIncidentPanel.jsx
import React from 'react';
import i18n from '../../../i18n';
import { CardsGrid, NoteCard, StatCard } from '../../../styles/AdminStyles';

const AuditIncidentPanel = () => {
  const t = (key, options) => i18n.t(key, options);
  return (
    <div>
      <CardsGrid>
        <StatCard>
          <div className="label">Incidents</div>
          <div className="meta" style={{ marginTop: 10 }}>
            {t('admin.audit.incident.description')}
            <ul style={{ margin: '8px 0 0 18px' }}>
              <li>{t('admin.audit.incident.checks.recentSevere')}</li>
              <li>{t('admin.audit.incident.checks.recentCritical')}</li>
              <li>{t('admin.audit.incident.checks.quickSummary')}</li>
              <li>{t('admin.audit.incident.checks.manualEntry')}</li>
            </ul>
          </div>
        </StatCard>

        <NoteCard $muted>
          <div className="label">Estado</div>
          <div className="meta">
            {t('admin.audit.incident.note')}
          </div>
        </NoteCard>
      </CardsGrid>
    </div>
  );
};

export default AuditIncidentPanel;