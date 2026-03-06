import React, { useEffect, useRef, useState } from 'react';
import { buildWsUrl, WS_PATHS } from '../../config/api';
import {
  CardsGrid,
  NoteCard,
  SectionTitle,
  StatCard,
  StyledError,
} from '../../styles/AdminStyles';

const AdminStatsPanel = () => {
  const [waitingModelsCount, setWaitingModelsCount] = useState(null);
  const [waitingClientsCount, setWaitingClientsCount] = useState(null);
  const [statsUpdatedAt, setStatsUpdatedAt] = useState(null);
  const [statsError, setStatsError] = useState('');
  const [modelsStreamingCount, setModelsStreamingCount] = useState(null);
  const [clientsStreamingCount, setClientsStreamingCount] = useState(null);

  const wsAdminRef = useRef(null);
  const pingAdminRef = useRef(null);

  useEffect(() => {
    setStatsError('');
    try {
      const wsUrl = buildWsUrl(WS_PATHS.match);
      const ws = new WebSocket(wsUrl);
      wsAdminRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'stats' }));
        pingAdminRef.current = setInterval(() => {
          if (wsAdminRef.current?.readyState === WebSocket.OPEN) {
            wsAdminRef.current.send(JSON.stringify({ type: 'stats' }));
          }
        }, 60000);
      };

      ws.onmessage = (evt) => {
        const data = JSON.parse(evt.data);
        if (data.type === 'queue-stats') {
          setWaitingModelsCount(data.waitingModels);
          setWaitingClientsCount(data.waitingClients);
          setModelsStreamingCount(data.modelsStreaming ?? data.activePairs ?? null);
          setClientsStreamingCount(data.clientsStreaming ?? data.activePairs ?? null);
          setStatsUpdatedAt(new Date());
        }
      };

      ws.onerror = () => setStatsError('Error de conexión con estadísticas.');
      ws.onclose = () => {
        if (pingAdminRef.current) {
          clearInterval(pingAdminRef.current);
          pingAdminRef.current = null;
        }
      };
    } catch (e) {
      setStatsError(e.message || 'No se pudo abrir estadísticas.');
    }

    return () => {
      if (pingAdminRef.current) {
        clearInterval(pingAdminRef.current);
        pingAdminRef.current = null;
      }
      if (wsAdminRef.current) {
        try {
          wsAdminRef.current.close();
        } catch {
          // noop
        }
        wsAdminRef.current = null;
      }
    };
  }, []);

  return (
    <div>
      <SectionTitle>Estadísticas</SectionTitle>
      {statsError && <StyledError>{statsError}</StyledError>}

      <CardsGrid>
        <StatCard>
          <div className="label">Modelos en cola</div>
          <div className="value">{waitingModelsCount ?? '—'}</div>
          <div className="meta">
            {statsUpdatedAt ? `Actualizado: ${statsUpdatedAt.toLocaleTimeString()}` : 'Actualizando…'}
          </div>
        </StatCard>

        <StatCard>
          <div className="label">Modelos en streaming</div>
          <div className="value">{modelsStreamingCount ?? '—'}</div>
          <div className="meta">
            {statsUpdatedAt ? `Actualizado: ${statsUpdatedAt.toLocaleTimeString()}` : 'Actualizando…'}
          </div>
        </StatCard>

        <StatCard>
          <div className="label">Clientes en streaming</div>
          <div className="value">{clientsStreamingCount ?? '—'}</div>
          <div className="meta">
            {statsUpdatedAt ? `Actualizado: ${statsUpdatedAt.toLocaleTimeString()}` : 'Actualizando…'}
          </div>
        </StatCard>

        <NoteCard>
          <div className="label">KPI futura</div>
          <div className="value">—</div>
        </NoteCard>

        <NoteCard>
          <div className="label">KPI futura</div>
          <div className="value">—</div>
        </NoteCard>
      </CardsGrid>
    </div>
  );
};

export default AdminStatsPanel;
