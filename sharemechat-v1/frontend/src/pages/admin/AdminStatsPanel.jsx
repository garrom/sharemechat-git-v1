import React, { useEffect, useRef, useState } from 'react';
import i18n from '../../i18n';
import {
  CardsGrid,
  NoteCard,
  SectionTitle,
  StatCard,
  StyledError,
} from '../../styles/AdminStyles';

const AdminStatsPanel = () => {
  const t = (key, options) => i18n.t(key, options);
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
          throw new Error((await res.text()) || i18n.t('admin.stats.errors.load'));
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
        setStatsError(e.message || i18n.t('admin.stats.errors.load'));
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

  const updatedLabel = statsUpdatedAt
    ? t('admin.stats.updatedAt', { time: statsUpdatedAt.toLocaleTimeString() })
    : t('admin.stats.updating');

  return (
    <div>
      <SectionTitle>{t('admin.stats.title')}</SectionTitle>
      {statsError && <StyledError>{statsError}</StyledError>}

      <CardsGrid>
        <StatCard>
          <div className="label">{t('admin.stats.cards.randomWaitingModels')}</div>
          <div className="value">{randomWaitingModels ?? '-'}</div>
          <div className="meta">{updatedLabel}</div>
        </StatCard>

        <StatCard>
          <div className="label">{t('admin.stats.cards.randomWaitingViewers')}</div>
          <div className="value">{randomWaitingViewers ?? '-'}</div>
          <div className="meta">{updatedLabel}</div>
        </StatCard>

        <StatCard>
          <div className="label">{t('admin.stats.cards.randomActivePairs')}</div>
          <div className="value">{randomActivePairs ?? '-'}</div>
          <div className="meta">{updatedLabel}</div>
        </StatCard>

        <StatCard>
          <div className="label">{t('admin.stats.cards.directRingingUsers')}</div>
          <div className="value">{directRingingUsers ?? '-'}</div>
          <div className="meta">{updatedLabel}</div>
        </StatCard>

        <StatCard>
          <div className="label">{t('admin.stats.cards.directActiveCalls')}</div>
          <div className="value">{directActiveCalls ?? '-'}</div>
          <div className="meta">{updatedLabel}</div>
        </StatCard>

        <StatCard>
          <div className="label">{t('admin.stats.cards.persistedRandomConnecting')}</div>
          <div className="value">{persistedRandomConnecting ?? '-'}</div>
          <div className="meta">{updatedLabel}</div>
        </StatCard>

        <StatCard>
          <div className="label">{t('admin.stats.cards.persistedRandomActive')}</div>
          <div className="value">{persistedRandomActive ?? '-'}</div>
          <div className="meta">{updatedLabel}</div>
        </StatCard>

        <StatCard>
          <div className="label">{t('admin.stats.cards.persistedCallingActive')}</div>
          <div className="value">{persistedCallingActive ?? '-'}</div>
          <div className="meta">{updatedLabel}</div>
        </StatCard>

        <NoteCard $muted>
          <div className="label">{t('admin.stats.coverage.title')}</div>
          <div className="meta">{t('admin.stats.coverage.body')}</div>
        </NoteCard>
      </CardsGrid>
    </div>
  );
};

export default AdminStatsPanel;
