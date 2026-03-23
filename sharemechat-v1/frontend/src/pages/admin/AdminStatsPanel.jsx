import React, { useEffect, useRef, useState } from 'react';
import {
  CardsGrid,
  NoteCard,
  SectionTitle,
  StatCard,
  StyledError,
} from '../../styles/AdminStyles';

const AdminStatsPanel = () => {
  const [randomWaitingModels, setRandomWaitingModels] = useState(null);
  const [randomWaitingViewers, setRandomWaitingViewers] = useState(null);
  const [randomActivePairs, setRandomActivePairs] = useState(null);
  const [directRingingUsers, setDirectRingingUsers] = useState(null);
  const [directActiveCalls, setDirectActiveCalls] = useState(null);
  const [persistedRandomConnecting, setPersistedRandomConnecting] = useState(null);
  const [persistedRandomActive, setPersistedRandomActive] = useState(null);
  const [persistedCallingActive, setPersistedCallingActive] = useState(null);
  const [statsUpdatedAt, setStatsUpdatedAt] = useState(null);
  const [statsError, setStatsError] = useState('');

  const refreshRef = useRef(null);

  useEffect(() => {
    const fetchStats = async () => {
      setStatsError('');
      try {
        const res = await fetch('/api/admin/stats/overview', {
          credentials: 'include',
        });
        if (!res.ok) {
          throw new Error((await res.text()) || 'Error al cargar estadísticas admin.');
        }

        const data = await res.json();
        setRandomWaitingModels(data.randomWaitingModels ?? null);
        setRandomWaitingViewers(data.randomWaitingViewers ?? null);
        setRandomActivePairs(data.randomActivePairs ?? null);
        setDirectRingingUsers(data.directRingingUsers ?? null);
        setDirectActiveCalls(data.directActiveCalls ?? null);
        setPersistedRandomConnecting(data.persistedRandomConnecting ?? null);
        setPersistedRandomActive(data.persistedRandomActive ?? null);
        setPersistedCallingActive(data.persistedCallingActive ?? null);
        setStatsUpdatedAt(new Date());
      } catch (e) {
        setStatsError(e.message || 'No se pudo cargar estadísticas admin.');
      }
    };

    fetchStats();
    refreshRef.current = setInterval(fetchStats, 60000);

    return () => {
      if (refreshRef.current) {
        clearInterval(refreshRef.current);
        refreshRef.current = null;
      }
    };
  }, []);

  const updatedLabel = statsUpdatedAt ? `Actualizado: ${statsUpdatedAt.toLocaleTimeString()}` : 'Actualizando…';

  return (
    <div>
      <SectionTitle>Estadísticas</SectionTitle>
      {statsError && <StyledError>{statsError}</StyledError>}

      <CardsGrid>
        <StatCard>
          <div className="label">Modelos en cola random</div>
          <div className="value">{randomWaitingModels ?? '—'}</div>
          <div className="meta">{updatedLabel}</div>
        </StatCard>

        <StatCard>
          <div className="label">Viewers en cola random</div>
          <div className="value">{randomWaitingViewers ?? '—'}</div>
          <div className="meta">{updatedLabel}</div>
        </StatCard>

        <StatCard>
          <div className="label">Pares random activos</div>
          <div className="value">{randomActivePairs ?? '—'}</div>
          <div className="meta">{updatedLabel}</div>
        </StatCard>

        <StatCard>
          <div className="label">Usuarios en ringing</div>
          <div className="value">{directRingingUsers ?? '—'}</div>
          <div className="meta">{updatedLabel}</div>
        </StatCard>

        <StatCard>
          <div className="label">Llamadas directas activas</div>
          <div className="value">{directActiveCalls ?? '—'}</div>
          <div className="meta">{updatedLabel}</div>
        </StatCard>

        <StatCard>
          <div className="label">RANDOM persistidos connecting</div>
          <div className="value">{persistedRandomConnecting ?? '—'}</div>
          <div className="meta">{updatedLabel}</div>
        </StatCard>

        <StatCard>
          <div className="label">RANDOM persistidos active</div>
          <div className="value">{persistedRandomActive ?? '—'}</div>
          <div className="meta">{updatedLabel}</div>
        </StatCard>

        <StatCard>
          <div className="label">CALLING persistidos active</div>
          <div className="value">{persistedCallingActive ?? '—'}</div>
          <div className="meta">{updatedLabel}</div>
        </StatCard>

        <NoteCard $muted>
          <div className="label">Cobertura</div>
          <div className="meta">
            Runtime random, llamadas directas en runtime y streams persistidos.
          </div>
        </NoteCard>
      </CardsGrid>
    </div>
  );
};

export default AdminStatsPanel;
