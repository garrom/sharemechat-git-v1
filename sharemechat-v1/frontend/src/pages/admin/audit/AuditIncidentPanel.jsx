// src/pages/admin/audit/AuditIncidentPanel.jsx
import React from 'react';
import { CardsGrid, NoteCard, StatCard } from '../../../styles/AdminStyles';

const AuditIncidentPanel = () => {
  return (
    <div>
      <CardsGrid>
        <StatCard>
          <div className="label">Incidents</div>
          <div className="meta" style={{ marginTop: 10 }}>
            Esta rama queda preparada para una vista operativa de incidentes críticos:
            <ul style={{ margin: '8px 0 0 18px' }}>
              <li>Últimos incidentes severos</li>
              <li>Anomalías críticas recientes</li>
              <li>Resumen rápido para operación</li>
              <li>Entrada a investigación manual</li>
            </ul>
          </div>
        </StatCard>

        <NoteCard $muted>
          <div className="label">Estado</div>
          <div className="meta">
            Panel preparado. Pendiente de conectar con una vista priorizada de incidentes y alertas.
          </div>
        </NoteCard>
      </CardsGrid>
    </div>
  );
};

export default AuditIncidentPanel;