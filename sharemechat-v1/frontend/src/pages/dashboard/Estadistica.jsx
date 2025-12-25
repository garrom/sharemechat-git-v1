// src/pages/dashboard/Estadistica.jsx
import React, { useMemo, useState, useRef } from 'react';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChartLine,
  faBullseye,
  faClockRotateLeft,
  faArrowUpRightDots,
} from '@fortawesome/free-solid-svg-icons';

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

    return `Tier "${t.name || ''}". Requisito: ${minReq} min facturados (ventana 30d). ` +
      `Tarifa: a partir de haber completado el primer minuto se cobra €${first}/min. ` +
      `Tarifa: desde el minuto 1 en adelante se cobra €${next}/min.`;
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
                    <MiniMeta>Según ventana {modelStatsDays}d</MiniMeta>
                  </MiniCard>

                  <MiniCard $accent="green">
                    <MiniLabel>Minutos (30días)</MiniLabel>
                    <MiniValue>{Number(current?.billedMinutes30d || 0)}</MiniValue>
                    <MiniMeta>
                      Horas: <b>{current?.billedHours30d || '—'}</b>
                    </MiniMeta>
                  </MiniCard>

                  <MiniCard $accent="amber">
                    <MiniLabel>Tarifa 1º minuto</MiniLabel>
                    <MiniValue>€{current?.firstMinuteEURPerMin || '0.0000'}/min</MiniValue>
                    <MiniMeta>Se aplica al primer minuto</MiniMeta>
                  </MiniCard>

                  <MiniCard $accent="purple">
                    <MiniLabel>Tarifa siguientes</MiniLabel>
                    <MiniValue>€{current?.nextMinutesEURPerMin || '0.0000'}/min</MiniValue>
                    <MiniMeta>Se aplica a partir del 2º minuto</MiniMeta>
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
                      {tiers.map((t) => (
                        <tr key={t?.tierId || t?.name}>
                          <td className="name">
                            <TierNameCell>
                              <span>{t?.name || '—'}</span>
                              <TierHelpIcon title={buildTierTooltip(t)} aria-label="Información del tier">
                                ?
                              </TierHelpIcon>
                            </TierNameCell>
                          </td>
                          <td style={{textAlign:'right'}}>{Number(t?.minBilledMinutes || 0)}</td>
                          <td style={{textAlign:'right'}}>€{t?.firstMinuteEURPerMin || '0.0000'}</td>
                          <td style={{textAlign:'right'}}>€{t?.nextMinutesEURPerMin || '0.0000'}</td>
                        </tr>
                      ))}

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
                        <th style={{textAlign:'right'}}>Minutos (30días)</th>
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

/* =========================
   Styled Components (tema claro / pastel)
   ========================= */

const Wrap = styled.div`
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;

  background: linear-gradient(
    180deg,
    rgba(248,250,252,0.92) 0%,
    rgba(241,245,249,0.92) 55%,
    rgba(236,254,255,0.65) 100%
  );

  color: rgba(15,23,42,0.92);
  overflow: auto;
  border-radius: 6px;
  border: 1px solid rgba(15,23,42,0.06);

  @media (max-width: 768px) {
    padding: 12px;
    border-radius: 14px;
  }
`;

const TopBar = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
`;

const TopLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
`;

const TopIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  background: rgba(34,197,94,0.14);
  border: 1px solid rgba(34,197,94,0.22);
  color: rgba(22,163,74,0.95);
`;

const Title = styled.div`
  font-size: 18px;
  font-weight: 900;
  color: rgba(2,6,23,0.92);
  letter-spacing: .2px;
`;

const SubTitle = styled.div`
  margin-top: 2px;
  font-size: 13px;
  color: rgba(30,41,59,0.78);
`;

const TopRight = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
  flex-wrap: wrap;
`;

const Filters = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const FilterLabel = styled.span`
  color: rgba(30,41,59,0.78);
  font-weight: 800;
`;

const Select = styled.select`
  height: 40px;
  border-radius: 12px;
  padding: 0 12px;

  border: 1px solid rgba(15,23,42,0.14);
  background: rgba(255,255,255,0.78);
  color: rgba(2,6,23,0.88);
  outline: none;

  &:hover {
    background: rgba(255,255,255,0.90);
  }

  &:focus {
    box-shadow: 0 0 0 3px rgba(59,130,246,0.18);
    border-color: rgba(59,130,246,0.40);
  }

  option {
    background: #ffffff;
    color: #111;
  }

  &:disabled {
    opacity: .65;
    cursor: not-allowed;
  }
`;

const ReloadBtn = styled.button`
  height: 40px;
  border-radius: 12px;
  padding: 0 14px;

  border: 1px solid rgba(15,23,42,0.14);
  background: rgba(255,255,255,0.78);
  color: rgba(2,6,23,0.88);
  cursor: pointer;
  font-weight: 900;

  &:hover:not(:disabled) {
    background: rgba(255,255,255,0.94);
  }

  &:disabled {
    opacity: .6;
    cursor: not-allowed;
  }
`;

const AvailabilityPill = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 999px;

  border: 1px solid rgba(59,130,246,0.22);
  background: rgba(59,130,246,0.10);
  color: rgba(30,64,175,0.92);

  font-weight: 900;
  font-size: 12px;
`;

const InfoLine = styled.div`
  border-radius: 14px;
  border: 1px solid rgba(59,130,246,0.20);
  background: rgba(59,130,246,0.08);
  color: rgba(30,64,175,0.92);
  font-weight: 900;
  padding: 10px 12px;
  line-height: 1.35;
`;

const TabsBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0px;
  flex-wrap: wrap;

  width: 100%;
  padding: 2px 2px 0 2px;

  /* Línea base tipo navegador (rosa pastel) */
  border-bottom: 1px solid rgba(236,72,153,0.22);

  @media (max-width: 768px) {
    flex-wrap: nowrap;
  }

`;


const TabButton = styled.button`
  appearance: none;
  -webkit-appearance: none;

  display: inline-flex;
  align-items: center;
  gap: 10px;

  padding: 10px 14px;
  border-radius: 2px 2px 0 0;

  cursor: pointer;
  font-weight: 900;
  white-space: nowrap;

  /* Estado normal: claro, visible */
  background: rgba(255,255,255,0.82);
  color: rgba(2,6,23,0.88);
  border: 1px solid rgba(15,23,42,0.12);

  /* Para que parezca pestaña sobre la línea */
  border-bottom-color: transparent;

  &:hover {
    background: rgba(236,72,153,0.08);
    border-color: rgba(236,72,153,0.22);
    border-bottom-color: transparent;
  }

  /* Activa: rosa pastel + “se integra” con la línea */
  &[data-active="true"] {
    background: rgba(236,72,153,0.14);
    border-color: rgba(236,72,153,0.28);
    color: rgba(157,23,77,0.96);
    border-bottom-color: rgba(248,250,252,0.92);
  }

  &:focus-visible {
    outline: 2px solid rgba(236,72,153,0.32);
    outline-offset: 2px;
  }

  @media (max-width: 768px) {
    padding: 8px 10px;
    font-size: 12px;
    gap: 6px;
  }
`;


const StateLine = styled.div`
  color: rgba(30,41,59,0.80);
  padding: 12px 2px;
  font-weight: 800;
`;

const ErrorLine = styled.div`
  color: rgba(185,28,28,0.92);
  font-weight: 900;
  padding: 12px 2px;
`;

const Section = styled.section`
  border-radius: 18px;
  border: 1px solid rgba(15,23,42,0.10);
  background: rgba(255,255,255,0.78);

  padding: 14px;

  box-shadow:
    0 10px 30px rgba(15,23,42,0.06),
    0 1px 0 rgba(255,255,255,0.65) inset;

  @media (max-width: 768px) {
    padding: 12px;
  }
`;

const SectionHead = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
`;

const SectionTitle = styled.div`
  font-size: 18px;
  font-weight: 1000;
  color: rgba(2,6,23,0.92);
  letter-spacing: .2px;
`;

const SectionHint = styled.div`
  font-size: 13px;
  font-weight: 800;
  color: rgba(30,41,59,0.70);
`;

const GridCards = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;

  &[data-compact="true"] {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));

    &[data-compact="true"] {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 680px) {
    grid-template-columns: 1fr;
  }
`;

const MiniCard = styled.div`
  border-radius: 16px;
  padding: 14px;

  border: 1px solid rgba(15,23,42,0.10);
  background: rgba(255,255,255,0.86);

  min-width: 0;

  transition: transform .10s ease, background-color .12s ease, border-color .12s ease, box-shadow .12s ease;

  &:hover {
    transform: translateY(-1px);
    background: rgba(255,255,255,0.96);
    border-color: rgba(15,23,42,0.14);
    box-shadow: 0 12px 28px rgba(15,23,42,0.08);
  }

  ${({ $accent }) => {
    if ($accent === 'green') {
      return `
        box-shadow: 0 0 0 3px rgba(34,197,94,0.10) inset;
        border-color: rgba(34,197,94,0.22);
      `;
    }
    if ($accent === 'blue') {
      return `
        box-shadow: 0 0 0 3px rgba(59,130,246,0.10) inset;
        border-color: rgba(59,130,246,0.22);
      `;
    }
    if ($accent === 'amber') {
      return `
        box-shadow: 0 0 0 3px rgba(245,158,11,0.10) inset;
        border-color: rgba(245,158,11,0.20);
      `;
    }
    if ($accent === 'purple') {
      return `
        box-shadow: 0 0 0 3px rgba(168,85,247,0.10) inset;
        border-color: rgba(168,85,247,0.20);
      `;
    }
    return '';
  }}
`;

const MiniLabel = styled.div`
  font-size: 12px;
  color: rgba(30,41,59,0.70);
  font-weight: 900;
`;

const MiniValue = styled.div`
  margin-top: 6px;
  font-size: 22px;
  font-weight: 1000;
  color: rgba(2,6,23,0.92);
  letter-spacing: .2px;

  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const MiniMeta = styled.div`
  margin-top: 8px;
  font-size: 13px;
  color: rgba(30,41,59,0.72);

  b { color: rgba(2,6,23,0.92); }
`;

const ProgressCard = styled.div`
  border-radius: 18px;
  padding: 14px;

  border: 1px solid rgba(15,23,42,0.10);
  background: rgba(248,250,252,0.90);

  box-shadow: 0 10px 28px rgba(15,23,42,0.06);
`;

const ProgressRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const ProgressCol = styled.div`
  min-width: 0;
`;

const KpiTitle = styled.div`
  font-weight: 1000;
  color: rgba(2,6,23,0.92);
  margin-bottom: 6px;
`;

const KpiLine = styled.div`
  font-size: 13px;
  color: rgba(30,41,59,0.78);
  line-height: 1.45;

  b { color: rgba(2,6,23,0.92); }
`;

const BarWrap = styled.div`
  margin-top: 14px;
`;

const BarTrack = styled.div`
  position: relative;
  height: 12px;
  border-radius: 999px;

  background: rgba(15,23,42,0.08);
  overflow: hidden;
  border: 1px solid rgba(15,23,42,0.12);
`;

const BarFill = styled.div`
  position: absolute;
  inset: 0 auto 0 0;
  height: 100%;
  border-radius: 999px;

  background: linear-gradient(
    90deg,
    rgba(34,197,94,0.95) 0%,
    rgba(59,130,246,0.92) 60%,
    rgba(168,85,247,0.90) 100%
  );
`;

const BarGlow = styled.div`
  position: absolute;
  inset: 0 auto 0 0;
  height: 100%;
  border-radius: 999px;
  box-shadow: 0 0 18px rgba(59,130,246,0.22);
  opacity: .65;
  pointer-events: none;
`;

const BarLegend = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  font-weight: 900;
  color: rgba(30,41,59,0.72);
`;

const SuccessPill = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 999px;

  background: rgba(34,197,94,0.12);
  border: 1px solid rgba(34,197,94,0.22);
  color: rgba(22,101,52,0.92);

  font-weight: 1000;
`;

const TableWrap = styled.div`
  width: 100%;
  overflow-x: auto;
  border-radius: 14px;

  border: 1px solid rgba(15,23,42,0.10);
  background: rgba(255,255,255,0.86);

  box-shadow: 0 8px 24px rgba(15,23,42,0.06);
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  min-width: 760px;

  thead th {
    text-align: left;
    padding: 12px 12px;
    font-size: 12px;
    letter-spacing: .2px;

    color: rgba(30,41,59,0.72);
    border-bottom: 1px solid rgba(15,23,42,0.08);
    background: rgba(248,250,252,0.92);
  }

  tbody td {
    padding: 12px 12px;
    border-bottom: 1px solid rgba(15,23,42,0.06);
    font-weight: 800;
    color: rgba(2,6,23,0.88);
  }

  tbody tr {
    transition: background-color .12s ease;
  }

  tbody tr:hover {
    background: rgba(59,130,246,0.06);
  }

  td.name {
    color: rgba(2,6,23,0.92);
    font-weight: 1000;
  }

  @media (max-width: 900px) {
    min-width: 680px;
  }
`;

const Placeholder = styled.div`
  border-radius: 14px;
  border: 1px dashed rgba(15,23,42,0.18);
  background: rgba(255,255,255,0.60);
  padding: 16px;
`;

const PlaceholderTitle = styled.div`
  font-weight: 1000;
  color: rgba(2,6,23,0.90);
`;

const PlaceholderText = styled.div`
  margin-top: 6px;
  color: rgba(30,41,59,0.74);
  font-weight: 700;
  line-height: 1.45;
`;

const TierNameCell = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`;

const TierHelpIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;

  width: 18px;
  height: 18px;
  border-radius: 999px;

  font-size: 12px;
  font-weight: 1000;
  line-height: 1;

  cursor: help;
  user-select: none;

  background: rgba(236,72,153,0.14);
  border: 1px solid rgba(236,72,153,0.22);
  color: rgba(157,23,77,0.96);

  &:hover {
    background: rgba(236,72,153,0.20);
    border-color: rgba(236,72,153,0.30);
  }
`;
