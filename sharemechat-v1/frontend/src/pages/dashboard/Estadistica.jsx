import React, { useMemo, useState, useRef } from 'react';
import i18n from '../../i18n';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChartLine,
  faClockRotateLeft,
  faTags,
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
  TableWrap,
  Table,
} from '../../styles/pages-styles/EstadisticaStyles';
import ModelBillingPanel from './ModelBillingPanel';
import ModelPricingPanel from './ModelPricingPanel';

// Colores por tab (ADR-052 §D9 request UX 2026-07-25): contorno de
// color siempre visible + fondo lleno al activar. Coherente con la
// paleta pastel del panel (misma familia que MiniCard).
//
// Iteracion 2 (2026-07-25): tab 'Progreso' retirado (fusionado en Tarifa).
// El tab por defecto pasa a ser 'pricing' porque es lo mas operativo para
// la modelo. Quedan 3 tabs: Tarifa (naranja), Historico (violeta),
// Facturacion (verde).
const TAB_COLORS = {
  pricing: '#f97316', // naranja
  detail:  '#8b5cf6', // violeta
  billing: '#22c55e', // verde
};

export default function Estadistica({
  modelStatsDays,
  setModelStatsDays,
  onReload,
  loading,
  error,
  modelStats,
}) {
  const t = (key, options) => i18n.t(key, options);
  const [tab, setTab] = useState('pricing');

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

  const availabilityText = useMemo(() => {
    if (loading) return '';
    if (snapshotsCount === 0) return t('dashboardModel.statistics.availability.zero');
    if (snapshotsCount === 1) return t('dashboardModel.statistics.availability.one');
    return t('dashboardModel.statistics.availability.many', { count: snapshotsCount });
  }, [loading, snapshotsCount, t]);

  // Los filtros de historico + reload solo aplican al tab Historico.
  const showHistoryFilters = tab === 'detail';

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

          {showHistoryFilters && (
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
          )}

          {showHistoryFilters && availabilityText && (
            <AvailabilityPill title={t('dashboardModel.statistics.availability.title')}>
              {availabilityText}
            </AvailabilityPill>
          )}
        </TopRight>
      </TopBar>

      <TabsBar>
        <TabButton
          type="button"
          data-active={tab === 'pricing'}
          onClick={() => setTab('pricing')}
          $color={TAB_COLORS.pricing}
        >
          <FontAwesomeIcon icon={faTags} />
          {t('dashboardModel.statistics.tabs.pricing')}
        </TabButton>

        <TabButton
          type="button"
          data-active={tab === 'detail'}
          onClick={() => setTab('detail')}
          $color={TAB_COLORS.detail}
        >
          <FontAwesomeIcon icon={faClockRotateLeft} />
          {t('dashboardModel.statistics.tabs.history')}
        </TabButton>

        <TabButton
          type="button"
          data-active={tab === 'billing'}
          onClick={() => setTab('billing')}
          $color={TAB_COLORS.billing}
        >
          <FontAwesomeIcon icon={faChartLine} />
          {t('dashboardModel.statistics.tabs.billing')}
        </TabButton>
      </TabsBar>

      {tab === 'pricing' ? (
        // ADR-052 sub-frente 3.C (2026-07-25): tab Tarifa con dashboard
        // de reparto + selector de tarifa autoservicio + toggle Pro +
        // barra de progreso + tabla referencia T0-T3.
        <ModelPricingPanel />
      ) : tab === 'detail' ? (
        <>
          {loading && <StateLine>{t('dashboardModel.statistics.status.loading')}</StateLine>}

          {!loading && error && (
            <ErrorLine>{t('dashboardModel.statistics.status.error', { error })}</ErrorLine>
          )}

          {!loading && !error && (
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
                      <th style={{ textAlign: 'right' }}>
                        {t('dashboardModel.statistics.history.table.minutes30d')}
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {history.map((row, idx) => (
                      <tr key={`${row?.snapshotDate || idx}`}>
                        <td className="hist-date">{row?.snapshotDate || '—'}</td>
                        <td className="name hist-tier">{row?.tierName || '—'}</td>
                        <td style={{ textAlign: 'right' }}>{Number(row?.billedMinutes30d || 0)}</td>
                      </tr>
                    ))}

                    {history.length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ padding: '14px', opacity: 0.85 }}>
                          {t('dashboardModel.statistics.history.empty')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </TableWrap>
            </Section>
          )}
        </>
      ) : (
        // Fase 2 (2026-07-19): tab Billing rellenada con el historial
        // economico real del modelo (STREAM_EARNING, GIFT_EARNING,
        // PAYOUT_REQUEST, PAYOUT_REQUEST_REVERT).
        <ModelBillingPanel />
      )}
    </Wrap>
  );
}
