import React, { useMemo, useState, useRef } from 'react';
import i18n from '../../i18n';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChartLine,
  faBullseye,
  faClockRotateLeft,
  faArrowUpRightDots,
  faChevronDown,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import {
  Wrap,
  TopBar,
  TopLeft,
  TopIcon,
  Title,
  SubTitle,
  TopRight,
  Filters,
  FilterLabel,
  Select,
  ReloadBtn,
  AvailabilityPill,
  PayoutNotice,
  TabsBar,
  TabButton,
  StateLine,
  ErrorLine,
  Section,
  SectionHead,
  SectionTitle,
  SectionHint,
  GridCards,
  MiniCard,
  MiniLabel,
  MiniValue,
  MiniMeta,
  ProgressCard,
  ProgressRow,
  ProgressCol,
  KpiTitle,
  KpiLine,
  BarWrap,
  BarTrack,
  BarFill,
  BarGlow,
  BarLegend,
  SuccessPill,
  TableWrap,
  Table,
  Placeholder,
  PlaceholderTitle,
  PlaceholderText,
  TierNameCell,
  TierExpandIcon,
  TierDetailText,
} from '../../styles/pages-styles/EstadisticaStyles';

export default function Estadistica({
  modelStatsDays,
  setModelStatsDays,
  onReload,
  loading,
  error,
  modelStats,
}) {
  const t = (key, options) => i18n.t(key, options);
  const [tab, setTab] = useState('progress');
  const [expandedTier, setExpandedTier] = useState(null);

  const current = modelStats?.current || null;
  const tiers = Array.isArray(modelStats?.tiers) ? modelStats.tiers : [];
  const history = Array.isArray(modelStats?.history) ? modelStats.history : [];

  const forcedDaysRef = useRef(false);
  const snapshotsCount = history.length;

  const disableLongRanges = !loading && snapshotsCount > 0 && snapshotsCount < 7;

  if (!loading && !error && disableLongRanges && modelStatsDays !== 7 && !forcedDaysRef.current) {
    forcedDaysRef.current = true;
    setTimeout(() => setModelStatsDays(7), 0);
  }

  if (!loading && (snapshotsCount >= 7 || snapshotsCount === 0) && forcedDaysRef.current) {
    forcedDaysRef.current = false;
  }

  const handleChangeDays = (e) => {
    const v = Number(e.target.value);
    setModelStatsDays(Number.isFinite(v) ? v : 30);
  };

  const formatEurPerMin = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return '0.0000';
    return n.toFixed(4);
  };

  const buildTierTooltip = (tier) => {
    if (!tier) return '';
    const first = formatEurPerMin(tier.firstMinuteEURPerMin);
    const next = formatEurPerMin(tier.nextMinutesEURPerMin);
    const minReq = Number(tier.minBilledMinutes || 0);

    return t('dashboardModel.statistics.tooltips.tier', {
      name: tier.name || '',
      minReq,
      first,
      next,
    });
  };

  const computed = useMemo(() => {
    const billed = Number(current?.billedMinutes30d || 0);

    const ordered = [...tiers]
      .filter((tier) => tier && (tier.active === true || tier.active === false))
      .sort((a, b) => Number(a?.minBilledMinutes || 0) - Number(b?.minBilledMinutes || 0));

    const byName = ordered.find(
      (tier) => String(tier?.name || '') === String(current?.tierName || '')
    );

    let byMinutes = null;
    for (const tier of ordered) {
      if (Number(tier?.minBilledMinutes || 0) <= billed) byMinutes = tier;
    }

    const currentTier = byName || byMinutes || ordered[0] || null;
    const currentMin = Number(currentTier?.minBilledMinutes || 0);

    const pivot = currentTier ? currentMin : billed;
    const nextTier = ordered.find((tier) => Number(tier?.minBilledMinutes || 0) > pivot) || null;

    const nextMin = Number(nextTier?.minBilledMinutes || 0);
    const remaining = nextTier ? Math.max(0, nextMin - billed) : 0;

    const progressPct = nextTier
      ? Math.max(0, Math.min(100, (billed / Math.max(1, nextMin)) * 100))
      : 100;

    const reached = nextTier ? billed >= nextMin : true;

    return {
      billed,
      ordered,
      currentTier,
      nextTier,
      remaining,
      progressPct,
      reached,
    };
  }, [current, tiers]);

  const availabilityText = useMemo(() => {
    if (loading) return '';
    if (snapshotsCount === 0) return t('dashboardModel.statistics.availability.zero');
    if (snapshotsCount === 1) return t('dashboardModel.statistics.availability.one');
    return t('dashboardModel.statistics.availability.many', { count: snapshotsCount });
  }, [loading, snapshotsCount, t]);

  return (
    <Wrap>
      <TopBar>
        <TopLeft>
          <TopIcon>
            <FontAwesomeIcon icon={faChartLine} />
          </TopIcon>

          <div>
            <Title>{t('dashboardModel.statistics.header.title')}</Title>
            <SubTitle>{t('dashboardModel.statistics.header.subtitle')}</SubTitle>
          </div>
        </TopLeft>

        <TopRight>
          <PayoutNotice role="note" aria-label={t('dashboardModel.statistics.payoutNotice.ariaLabel')}>
            <b>{t('dashboardModel.statistics.payoutNotice.label')}</b>{' '}
            {t('dashboardModel.statistics.payoutNotice.message')}
          </PayoutNotice>

          <Filters>
            <FilterLabel>{t('dashboardModel.statistics.filters.history')}</FilterLabel>

            <Select
              value={modelStatsDays}
              onChange={handleChangeDays}
              aria-label={t('dashboardModel.statistics.filters.rangeAriaLabel')}
            >
              <option value={7}>{t('dashboardModel.statistics.filters.days7')}</option>
              <option value={30} disabled={disableLongRanges}>
                {t('dashboardModel.statistics.filters.days30')}
              </option>
              <option value={60} disabled={disableLongRanges}>
                {t('dashboardModel.statistics.filters.days60')}
              </option>
              <option value={90} disabled={disableLongRanges}>
                {t('dashboardModel.statistics.filters.days90')}
              </option>
              <option value={120} disabled={disableLongRanges}>
                {t('dashboardModel.statistics.filters.days120')}
              </option>
            </Select>

            <ReloadBtn type="button" onClick={onReload} disabled={loading}>
              {t('dashboardModel.statistics.filters.reload')}
            </ReloadBtn>
          </Filters>

          {availabilityText && (
            <AvailabilityPill title={t('dashboardModel.statistics.availability.title')}>
              {availabilityText}
            </AvailabilityPill>
          )}
        </TopRight>
      </TopBar>

      <TabsBar>
        <TabButton
          type="button"
          data-active={tab === 'progress'}
          onClick={() => setTab('progress')}
        >
          <FontAwesomeIcon icon={faBullseye} />
          {t('dashboardModel.statistics.tabs.progress')}
        </TabButton>

        <TabButton
          type="button"
          data-active={tab === 'detail'}
          onClick={() => setTab('detail')}
        >
          <FontAwesomeIcon icon={faClockRotateLeft} />
          {t('dashboardModel.statistics.tabs.history')}
        </TabButton>

        <TabButton
          type="button"
          data-active={tab === 'billing'}
          onClick={() => setTab('billing')}
        >
          <FontAwesomeIcon icon={faChartLine} />
          {t('dashboardModel.statistics.tabs.billing')}
        </TabButton>
      </TabsBar>

      {loading && <StateLine>{t('dashboardModel.statistics.status.loading')}</StateLine>}

      {!loading && error && (
        <ErrorLine>{t('dashboardModel.statistics.status.error', { error })}</ErrorLine>
      )}

      {!loading && !error && (
        <>
          {tab === 'progress' ? (
            <>
              <Section>
                <SectionHead>
                  <SectionTitle>{t('dashboardModel.statistics.currentSnapshot.title')}</SectionTitle>
                  <SectionHint>{t('dashboardModel.statistics.currentSnapshot.hint')}</SectionHint>
                </SectionHead>

                <GridCards>
                  <MiniCard>
                    <MiniLabel>{t('dashboardModel.statistics.cards.date.label')}</MiniLabel>
                    <MiniValue>{current?.snapshotDate || '—'}</MiniValue>
                    <MiniMeta>{t('dashboardModel.statistics.cards.date.meta')}</MiniMeta>
                  </MiniCard>

                  <MiniCard $accent="blue">
                    <MiniLabel>{t('dashboardModel.statistics.cards.currentTier.label')}</MiniLabel>
                    <MiniValue>{current?.tierName || '—'}</MiniValue>
                    <MiniMeta>{t('dashboardModel.statistics.cards.currentTier.meta')}</MiniMeta>
                  </MiniCard>

                  <MiniCard $accent="green">
                    <MiniLabel>{t('dashboardModel.statistics.cards.minutes30d.label')}</MiniLabel>
                    <MiniValue>{Number(current?.billedMinutes30d || 0)}</MiniValue>
                    <MiniMeta>
                      {t('dashboardModel.statistics.cards.minutes30d.hours', {
                        hours: current?.billedHours30d || '—',
                      })}
                    </MiniMeta>
                  </MiniCard>

                  <MiniCard $accent="amber">
                    <MiniLabel>{t('dashboardModel.statistics.cards.firstMinuteRate.label')}</MiniLabel>
                    <MiniValue>
                      {t('dashboardModel.statistics.cards.firstMinuteRate.value', {
                        amount: current?.firstMinuteEURPerMin || '0.0000',
                      })}
                    </MiniValue>
                    <MiniMeta>{t('dashboardModel.statistics.cards.firstMinuteRate.meta')}</MiniMeta>
                  </MiniCard>

                  <MiniCard $accent="purple">
                    <MiniLabel>{t('dashboardModel.statistics.cards.nextMinutesRate.label')}</MiniLabel>
                    <MiniValue>
                      {t('dashboardModel.statistics.cards.nextMinutesRate.value', {
                        amount: current?.nextMinutesEURPerMin || '0.0000',
                      })}
                    </MiniValue>
                    <MiniMeta>{t('dashboardModel.statistics.cards.nextMinutesRate.meta')}</MiniMeta>
                  </MiniCard>
                </GridCards>
              </Section>

              <Section>
                <SectionHead>
                  <SectionTitle>
                    <FontAwesomeIcon icon={faArrowUpRightDots} style={{marginRight:8}} />
                    {t('dashboardModel.statistics.progress.title')}
                  </SectionTitle>
                  <SectionHint>{t('dashboardModel.statistics.progress.hint')}</SectionHint>
                </SectionHead>

                <ProgressCard>
                  <ProgressRow>
                    <ProgressCol>
                      <KpiTitle>{t('dashboardModel.statistics.progress.current.title')}</KpiTitle>
                      <KpiLine>
                        {t('dashboardModel.statistics.progress.current.minutesLabel')} <b>{computed.billed}</b>
                      </KpiLine>
                      <KpiLine>
                        {t('dashboardModel.statistics.progress.current.tierLabel')} <b>{computed.currentTier?.name || current?.tierName || '—'}</b>
                      </KpiLine>
                    </ProgressCol>

                    <ProgressCol>
                      <KpiTitle>{t('dashboardModel.statistics.progress.next.title')}</KpiTitle>
                      {computed.nextTier ? (
                        <>
                          <KpiLine>
                            {t('dashboardModel.statistics.progress.next.tierLabel')} <b>{computed.nextTier?.name || '—'}</b>
                          </KpiLine>
                          <KpiLine>
                            {t('dashboardModel.statistics.progress.next.requirementLabel')} <b>{Number(computed.nextTier?.minBilledMinutes || 0)}</b> {t('dashboardModel.statistics.units.minutesShort')}
                          </KpiLine>
                          <KpiLine>
                            {t('dashboardModel.statistics.progress.next.remainingLabel')} <b>{computed.remaining}</b> {t('dashboardModel.statistics.units.minutesShort')}
                          </KpiLine>
                        </>
                      ) : (
                        <KpiLine>{t('dashboardModel.statistics.progress.next.maxTier')}</KpiLine>
                      )}
                    </ProgressCol>
                  </ProgressRow>

                  <BarWrap>
                    <BarTrack>
                      <BarFill style={{width:`${computed.progressPct}%`}} />
                      <BarGlow style={{width:`${computed.progressPct}%`}} />
                    </BarTrack>

                    <BarLegend>
                      <span>
                        {t('dashboardModel.statistics.progress.legend.current', {
                          count: computed.billed,
                          unit: t('dashboardModel.statistics.units.minutesShort'),
                        })}
                      </span>
                      <span>
                        {computed.nextTier
                          ? t('dashboardModel.statistics.progress.legend.next', {
                              count: Number(computed.nextTier?.minBilledMinutes || 0),
                              unit: t('dashboardModel.statistics.units.minutesShort'),
                            })
                          : '—'}
                      </span>
                    </BarLegend>
                  </BarWrap>

                  {computed.nextTier && computed.remaining === 0 && (
                    <SuccessPill>{t('dashboardModel.statistics.progress.goalReached')}</SuccessPill>
                  )}
                </ProgressCard>
              </Section>

              <Section>
                <SectionHead>
                  <SectionTitle>{t('dashboardModel.statistics.tiers.title')}</SectionTitle>
                  <SectionHint>{t('dashboardModel.statistics.tiers.hint')}</SectionHint>
                </SectionHead>

                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <th>{t('dashboardModel.statistics.tiers.table.name')}</th>
                        <th style={{textAlign:'right'}}>
                          {t('dashboardModel.statistics.tiers.table.minBilled')}
                        </th>
                        <th style={{textAlign:'right'}}>
                          {t('dashboardModel.statistics.tiers.table.firstMinute')}
                        </th>
                        <th style={{textAlign:'right'}}>
                          {t('dashboardModel.statistics.tiers.table.nextMinutes')}
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {tiers.map((tier) => {
                        const tierId = tier?.tierId ?? tier?.name;

                        return (
                          <React.Fragment key={tierId}>
                            <tr
                              className="is-expandable"
                              onClick={() => setExpandedTier(expandedTier === tierId ? null : tierId)}
                              aria-expanded={expandedTier === tierId}
                            >
                              <td className="name">
                                <TierNameCell>
                                  <TierExpandIcon aria-hidden="true">
                                    <FontAwesomeIcon
                                      icon={expandedTier === tierId ? faChevronDown : faChevronRight}
                                    />
                                  </TierExpandIcon>
                                  <span>{tier?.name || '—'}</span>
                                </TierNameCell>
                              </td>
                              <td style={{textAlign:'right'}}>{Number(tier?.minBilledMinutes || 0)}</td>
                              <td style={{textAlign:'right'}}>€{tier?.firstMinuteEURPerMin || '0.0000'}</td>
                              <td style={{textAlign:'right'}}>€{tier?.nextMinutesEURPerMin || '0.0000'}</td>
                            </tr>

                            {expandedTier === tierId && (
                              <tr className="tier-detail">
                                <td colSpan={4}>
                                  <TierDetailText>{buildTierTooltip(tier)}</TierDetailText>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}

                      {tiers.length === 0 && (
                        <tr>
                          <td colSpan={4} style={{padding:'14px',opacity:0.85}}>
                            {t('dashboardModel.statistics.tiers.empty')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </TableWrap>
              </Section>
            </>
          ) : tab === 'detail' ? (
            <>
              <Section>
                <SectionHead>
                  <SectionTitle>{t('dashboardModel.statistics.history.title')}</SectionTitle>
                  <SectionHint>{t('dashboardModel.statistics.history.hint')}</SectionHint>
                </SectionHead>

                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <th>{t('dashboardModel.statistics.history.table.date')}</th>
                        <th>{t('dashboardModel.statistics.history.table.tier')}</th>
                        <th style={{textAlign:'right'}}>
                          {t('dashboardModel.statistics.history.table.minutes30d')}
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {history.map((row, idx) => (
                        <tr key={`${row?.snapshotDate || idx}`}>
                          <td className="hist-date">{row?.snapshotDate || '—'}</td>
                          <td className="name hist-tier">{row?.tierName || '—'}</td>
                          <td style={{textAlign:'right'}}>{Number(row?.billedMinutes30d || 0)}</td>
                        </tr>
                      ))}

                      {history.length === 0 && (
                        <tr>
                          <td colSpan={3} style={{padding:'14px',opacity:0.85}}>
                            {t('dashboardModel.statistics.history.empty')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </TableWrap>
              </Section>
            </>
          ) : (
            <Section>
              <SectionHead>
                <SectionTitle>{t('dashboardModel.statistics.billing.title')}</SectionTitle>
                <SectionHint>{t('dashboardModel.statistics.billing.hint')}</SectionHint>
              </SectionHead>

              <Placeholder>
                <PlaceholderTitle>{t('dashboardModel.statistics.billing.placeholderTitle')}</PlaceholderTitle>
                <PlaceholderText>
                  {t('dashboardModel.statistics.billing.placeholderText')}
                </PlaceholderText>
              </Placeholder>
            </Section>
          )}
        </>
      )}
    </Wrap>
  );
}
