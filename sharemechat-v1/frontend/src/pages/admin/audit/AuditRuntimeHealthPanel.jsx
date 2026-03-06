// src/pages/admin/audit/AuditRuntimeHealthPanel.jsx
import React from 'react';
import { CardsGrid, NoteCard, StatCard } from '../../../styles/AdminStyles';

const AuditRuntimeHealthPanel = () => {
  return (
    <div>
      <CardsGrid>
        <StatCard>
          <div className="label">Runtime Health</div>
          <div className="meta" style={{ marginTop: 10 }}>
            Esta rama queda preparada para revisar estado operativo en memoria y señales runtime:
            <ul style={{ margin: '8px 0 0 18px' }}>
              <li>Pairs activos huérfanos</li>
              <li>Active calls sin stream asociado</li>
              <li>Locks stale</li>
              <li>Colas o estados incoherentes</li>
            </ul>
          </div>
        </StatCard>

        <NoteCard $muted>
          <div className="label">Estado</div>
          <div className="meta">
            Panel preparado. Pendiente de exponer checks de salud runtime desde backend/admin.
          </div>
        </NoteCard>
      </CardsGrid>
    </div>
  );
};

export default AuditRuntimeHealthPanel;