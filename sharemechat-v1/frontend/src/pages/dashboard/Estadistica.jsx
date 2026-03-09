import React, { useMemo, useState, useRef } from 'react';
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

/**
 * Estadistica (DashboardModel)
 * - 2 pestañas: Progreso / Histórico
 * - NO incluye "días libres"
 *
 * Props esperadas (mínimas):
 *  - modelStatsDays: number
 *  - setModelStatsDays: (n:number)=>void
 *  - onReload: ()=>void
 *  - loading: boolean
 *  - error: string|null
 *  - modelStats: {
 *      current: { snapshotDate, billedMinutes30d, billedHours30d, tierName, firstMinuteEURPerMin, nextMinutesEURPerMin }
 *      history: [{ snapshotDate, billedMinutes30d, tierName }]
 *      tiers: [{ tierId, name, minBilledMinutes, firstMinuteEURPerMin, nextMinutesEURPerMin, active }]
 *    }
 */

export default function Estadistica({
  modelStatsDays,
  setModelStatsDays,
  onReload,
  loading,
  error,
  modelStats,
}) {
  const [tab, setTab] = useState('progress'); // 'progress' | 'detail'
  const [expandedTier, setExpandedTier] = useState(null);

  const current = modelStats?.current || null;
  const tiers = Array.isArray(modelStats?.tiers) ? modelStats.tiers : [];
  const history = Array.isArray(modelStats?.history) ? modelStats.history : [];

  const forcedDaysRef = useRef(false);
  const snapshotsCount = history.length;

  // Regla UX: si < 7 snapshots, deshabilitar 30/60/90/120 (dejando 7)
  const disableLongRanges = !loading && snapshotsCount > 0 && snapshotsCount < 7;

  // Si no hay suficiente histórico, forzamos a 7 para mantener coherencia visual
  if (!loading && !error && disableLongRanges && modelStatsDays !== 7 && !forcedDaysRef.current) {
    forcedDaysRef.current = true;
    setTimeout(() => setModelStatsDays(7), 0);
  }

  // Cuando ya hay suficiente histórico, reseteamos el guard
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

  const buildTierTooltip = (t) => {
    if (!t) return '';
    const first = formatEurPerMin(t.firstMinuteEURPerMin);
    const next = formatEurPerMin(t.nextMinutesEURPerMin);
    const minReq = Number(t.minBilledMinutes || 0);

    return `Tier "${t.name || ''}". Requisito: ${minReq} minutos facturados en ventana móvil de 30 días. Tarifa del primer minuto: €${first}/min. Tarifa a partir del segundo minuto: €${next}/min.`;
  };

  const computed = useMemo(() => {
    const billed = Number(current?.billedMinutes30d || 0);

    const ordered = [...tiers]
      .filter((t) => t && (t.active === true || t.active === false))
      .sort((a, b) => Number(a?.minBilledMinutes || 0) - Number(b?.minBilledMinutes || 0));

    const byName = ordered.find(
      (t) => String(t?.name || '') === String(current?.tierName || '')
    );

    let byMinutes = null;
    for (const t of ordered) {
      if (Number(t?.minBilledMinutes || 0) <= billed) byMinutes = t;
    }

    const currentTier = byName || byMinutes || ordered[0] || null;
    const currentMin = Number(currentTier?.minBilledMinutes || 0);

    const pivot = currentTier ? currentMin : billed;
    const nextTier = ordered.find((t) => Number(t?.minBilledMinutes || 0) > pivot) || null;

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
    if (snapshotsCount === 0) return 'Histórico disponible: 0 días (aún no hay snapshots).';
    if (snapshotsCount === 1) return 'Histórico disponible: 1 día.';
    return `Histórico disponible: ${snapshotsCount} días.`;
  }, [loading, snapshotsCount]);

  return (
    <Wrap>
      <TopBar>
        <TopLeft>
          <TopIcon>
            <FontAwesomeIcon icon={faChartLine} />
          </TopIcon>

          <div>
            <Title>Estadísticas</Title>
            <SubTitle>Resumen de tier, minutos y tarifas. Datos basados en snapshots diarios.</SubTitle>
          </div>
        </TopLeft>

        <TopRight>
          <PayoutNotice role="note" aria-label="Minimum payout threshold">
            <b>Minimum payout threshold:</b> La Plataforma aplica actualmente un umbral mínimo de pago de €100 para retiros y liquidaciones, sujeto a la política vigente y al cumplimiento de los requisitos de verificación, datos de pago válidos y revisiones aplicables.
          </PayoutNotice>

          <Filters>
            <FilterLabel>Histórico:</FilterLabel>

            <Select
              value={modelStatsDays}
              onChange={handleChangeDays}
              aria-label="Seleccionar rango histórico"
            >
              <option value={7}>7 días</option>
              <option value={30} disabled={disableLongRanges}>
                30 días
              </option>
              <option value={60} disabled={disableLongRanges}>
                60 días
              </option>
              <option value={90} disabled={disableLongRanges}>
                90 días
              </option>
              <option value={120} disabled={disableLongRanges}>
                120 días
              </option>
            </Select>

            <ReloadBtn type="button" onClick={onReload} disabled={loading}>
              Recargar
            </ReloadBtn>
          </Filters>

          {availabilityText && (
            <AvailabilityPill title="Disponibilidad real de histórico (según snapshots existentes)">
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
          Progreso
        </TabButton>

        <TabButton
          type="button"
          data-active={tab === 'detail'}
          onClick={() => setTab('detail')}
        >
          <FontAwesomeIcon icon={faClockRotateLeft} />
          Histórico
        </TabButton>

        <TabButton
          type="button"
          data-active={tab === 'billing'}
          onClick={() => setTab('billing')}
        >
          <FontAwesomeIcon icon={faChartLine} />
          Facturación
        </TabButton>
      </TabsBar>

      {loading && <StateLine>Cargando estadísticas…</StateLine>}

      {!loading && error && <ErrorLine>Error: {error}</ErrorLine>}

      {!loading && !error && (
        <>
          {tab === 'progress' ? (
            <>
              <Section>
                <SectionHead>
                  <SectionTitle>Snapshot actual (ayer)</SectionTitle>
                  <SectionHint>Vista rápida para que sepas en qué punto estás.</SectionHint>
                </SectionHead>

                <GridCards>
                  <MiniCard>
                    <MiniLabel>Fecha</MiniLabel>
                    <MiniValue>{current?.snapshotDate || '—'}</MiniValue>
                    <MiniMeta>Último snapshot disponible</MiniMeta>
                  </MiniCard>

                  <MiniCard $accent="blue">
                    <MiniLabel>Tier actual</MiniLabel>
                    <MiniValue>{current?.tierName || '—'}</MiniValue>
                    <MiniMeta>Según ventana móvil de 30 días</MiniMeta>
                  </MiniCard>

                  <MiniCard $accent="green">
                    <MiniLabel>Minutos (30 días)</MiniLabel>
                    <MiniValue>{Number(current?.billedMinutes30d || 0)}</MiniValue>
                    <MiniMeta>
                      Horas: <b>{current?.billedHours30d || '—'}</b>
                    </MiniMeta>
                  </MiniCard>

                  <MiniCard $accent="amber">
                    <MiniLabel>Tarifa primer minuto</MiniLabel>
                    <MiniValue>€{current?.firstMinuteEURPerMin || '0.0000'}/min</MiniValue>
                    <MiniMeta>Se aplica al primer minuto completo de la sesión.</MiniMeta>
                  </MiniCard>

                  <MiniCard $accent="purple">
                    <MiniLabel>Tarifa minutos siguientes</MiniLabel>
                    <MiniValue>€{current?.nextMinutesEURPerMin || '0.0000'}/min</MiniValue>
                    <MiniMeta>Se aplica a partir del segundo minuto de la sesión.</MiniMeta>
                  </MiniCard>
                </GridCards>
              </Section>

              <Section>
                <SectionHead>
                  <SectionTitle>
                    <FontAwesomeIcon icon={faArrowUpRightDots} style={{marginRight:8}} />
                    Progreso hacia el siguiente tier
                  </SectionTitle>
                  <SectionHint>Objetivo y minutos que te faltan para subir.</SectionHint>
                </SectionHead>

                <ProgressCard>
                  <ProgressRow>
                    <ProgressCol>
                      <KpiTitle>Tu situación</KpiTitle>
                      <KpiLine>
                        Minutos actuales: <b>{computed.billed}</b>
                      </KpiLine>
                      <KpiLine>
                        Tier detectado: <b>{computed.currentTier?.name || current?.tierName || '—'}</b>
                      </KpiLine>
                    </ProgressCol>

                    <ProgressCol>
                      <KpiTitle>Siguiente objetivo</KpiTitle>
                      {computed.nextTier ? (
                        <>
                          <KpiLine>
                            Siguiente tier: <b>{computed.nextTier?.name || '—'}</b>
                          </KpiLine>
                          <KpiLine>
                            Requisito: <b>{Number(computed.nextTier?.minBilledMinutes || 0)}</b> min
                          </KpiLine>
                          <KpiLine>
                            Te faltan: <b>{computed.remaining}</b> min
                          </KpiLine>
                        </>
                      ) : (
                        <KpiLine>Ya estás en el tier máximo (o no hay siguiente tier configurado).</KpiLine>
                      )}
                    </ProgressCol>
                  </ProgressRow>

                  <BarWrap>
                    <BarTrack>
                      <BarFill style={{width:`${computed.progressPct}%`}} />
                      <BarGlow style={{width:`${computed.progressPct}%`}} />
                    </BarTrack>

                    <BarLegend>
                      <span>{computed.billed} min</span>
                      <span>
                        {computed.nextTier
                          ? `${Number(computed.nextTier?.minBilledMinutes || 0)} min`
                          : '—'}
                      </span>
                    </BarLegend>
                  </BarWrap>

                  {computed.nextTier && computed.remaining === 0 && (
                    <SuccessPill>Tier objetivo alcanzado</SuccessPill>
                  )}
                </ProgressCard>
              </Section>

              <Section>
                <SectionHead>
                  <SectionTitle>Tiers activos</SectionTitle>
                  <SectionHint>Tabla de referencia (configuración actual).</SectionHint>
                </SectionHead>

                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th style={{textAlign:'right'}}>Min. facturados</th>
                        <th style={{textAlign:'right'}}>1º min (€/min)</th>
                        <th style={{textAlign:'right'}}>Sig. (€/min)</th>
                      </tr>
                    </thead>

                    <tbody>
                      {tiers.map((t) => {
                        const tierId = t?.tierId ?? t?.name;

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
                                  <span>{t?.name || '—'}</span>
                                </TierNameCell>
                              </td>
                              <td style={{textAlign:'right'}}>{Number(t?.minBilledMinutes || 0)}</td>
                              <td style={{textAlign:'right'}}>€{t?.firstMinuteEURPerMin || '0.0000'}</td>
                              <td style={{textAlign:'right'}}>€{t?.nextMinutesEURPerMin || '0.0000'}</td>
                            </tr>

                            {expandedTier === tierId && (
                              <tr className="tier-detail">
                                <td colSpan={4}>
                                  <TierDetailText>{buildTierTooltip(t)}</TierDetailText>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}

                      {tiers.length === 0 && (
                        <tr>
                          <td colSpan={4} style={{padding:'14px',opacity:0.85}}>
                            No hay tiers configurados.
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
                  <SectionTitle>Historial</SectionTitle>
                  <SectionHint>Evolución por fecha.</SectionHint>
                </SectionHead>

                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Tier</th>
                        <th style={{textAlign:'right'}}>Minutos (30 días)</th>
                      </tr>
                    </thead>

                    <tbody>
                      {history.map((r, idx) => (
                        <tr key={`${r?.snapshotDate || idx}`}>
                          <td>{r?.snapshotDate || '—'}</td>
                          <td className="name">{r?.tierName || '—'}</td>
                          <td style={{textAlign:'right'}}>{Number(r?.billedMinutes30d || 0)}</td>
                        </tr>
                      ))}

                      {history.length === 0 && (
                        <tr>
                          <td colSpan={3} style={{padding:'14px',opacity:0.85}}>
                            Sin historial.
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
                <SectionTitle>Facturación</SectionTitle>
                <SectionHint>En construcción</SectionHint>
              </SectionHead>

              <Placeholder>
                <PlaceholderTitle>En construcción</PlaceholderTitle>
                <PlaceholderText>
                  Esta sección se habilitará en próximas versiones para mostrar desglose, periodos y liquidaciones.
                </PlaceholderText>
              </Placeholder>
            </Section>
          )}
        </>
      )}
    </Wrap>
  );
}