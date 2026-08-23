import React, { useMemo, useState, useRef } from 'react';
import i18n from '../../i18n';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChartLine,
  faClockRotateLeft,
  faTags,
  faCalendarDays,
  faCircleInfo,
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
import ModelSchedulePanel from './ModelSchedulePanel';

// Colores por tab (ADR-052 §D9 request UX 2026-07-25): contorno de
// color siempre visible + fondo lleno al activar. Coherente con la
// paleta pastel del panel (misma familia que MiniCard).
//
// Iteracion 2 (2026-07-25): tab 'Progreso' retirado (fusionado en Tarifa).
// El tab por defecto pasa a ser 'pricing' porque es lo mas operativo para
// la modelo. Quedan 3 tabs: Tarifa (naranja), Historico (violeta),
// Facturacion (verde).
const TAB_COLORS = {
  pricing:  '#f97316', // naranja
  detail:   '#8b5cf6', // violeta
  billing:  '#22c55e', // verde
  schedule: '#0ea5e9', // teal — Horarios (2026-08-23)
};

// Fusiona el histórico (una fila por día, con `billedMinutes30d` acumulado
// móvil) en RANGOS de días consecutivos sin cambios: mismo tramo Y mismos
// minutos. Devuelve filas { start, end, tier, minutes, days }. Asume `history`
// ordenado por fecha descendente (como lo sirve el backend); agrupa por
// igualdad consecutiva sin reordenar.
function collapseHistory(history) {
  const rows = [];
  for (const r of history) {
    const tier = r?.tierName || '—';
    const minutes = Number(r?.billedMinutes30d || 0);
    const date = r?.snapshotDate || '—';
    const last = rows[rows.length - 1];
    if (last && last.tier === tier && last.minutes === minutes) {
      // El histórico viene desc: el primer visto es el `end`, el último el `start`.
      last.start = date;
      last.days += 1;
    } else {
      rows.push({ start: date, end: date, tier, minutes, days: 1 });
    }
  }
  return rows;
}

// "2026-08-11" -> "11 ago". Fallback al valor crudo si no parsea.
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function shortDate(iso) {
  if (typeof iso !== 'string') return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const day = Number(m[3]);
  const mon = MONTHS_ES[Number(m[2]) - 1] || m[2];
  return `${day} ${mon}`;
}
function rangeLabel(row) {
  return row.start === row.end
    ? shortDate(row.end)
    : `${shortDate(row.start)} – ${shortDate(row.end)}`;
}

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

  const history = useMemo(
    () => (Array.isArray(modelStats?.history) ? modelStats.history : []),
    [modelStats],
  );
  const historyRanges = useMemo(() => collapseHistory(history), [history]);

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

      <PayoutNotice role="note" aria-label={t('dashboardModel.statistics.payoutNotice.ariaLabel')}>
        <FontAwesomeIcon icon={faCircleInfo} className="payout-ic" />
        <span>
          <b>{t('dashboardModel.statistics.payoutNotice.label')}</b>{' '}
          {t('dashboardModel.statistics.payoutNotice.message')}
        </span>
      </PayoutNotice>

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

        <TabButton
          type="button"
          data-active={tab === 'schedule'}
          onClick={() => setTab('schedule')}
          $color={TAB_COLORS.schedule}
        >
          <FontAwesomeIcon icon={faCalendarDays} />
          {t('dashboardModel.statistics.tabs.schedule')}
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
                      <th>{t('dashboardModel.statistics.history.table.period')}</th>
                      <th>{t('dashboardModel.statistics.history.table.tier')}</th>
                      <th style={{ textAlign: 'right' }}>
                        {t('dashboardModel.statistics.history.table.minutes30d')}
                      </th>
                      <th style={{ textAlign: 'right' }}>
                        {t('dashboardModel.statistics.history.table.days')}
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {historyRanges.map((row, idx) => (
                      <tr key={`${row.start}-${row.end}-${idx}`}>
                        <td className="hist-date">{rangeLabel(row)}</td>
                        <td className="name hist-tier">{row.tier}</td>
                        <td style={{ textAlign: 'right' }}>{row.minutes}</td>
                        <td style={{ textAlign: 'right' }}>{row.days}</td>
                      </tr>
                    ))}

                    {historyRanges.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ padding: '14px', opacity: 0.85 }}>
                          {t('dashboardModel.statistics.history.empty')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </TableWrap>

              <SectionHint style={{ marginTop: 10 }}>
                {t('dashboardModel.statistics.history.rollingNote')}
              </SectionHint>
            </Section>
          )}
        </>
      ) : tab === 'schedule' ? (
        // Horarios (2026-08-23): histograma día×hora "cuándo sueles estar en
        // línea", traído del "ver perfil" (availability del public-profile).
        <ModelSchedulePanel />
      ) : (
        // Fase 2 (2026-07-19): tab Billing rellenada con el historial
        // economico real del modelo (STREAM_EARNING, GIFT_EARNING,
        // PAYOUT_REQUEST, PAYOUT_REQUEST_REVERT).
        <ModelBillingPanel />
      )}
    </Wrap>
  );
}
