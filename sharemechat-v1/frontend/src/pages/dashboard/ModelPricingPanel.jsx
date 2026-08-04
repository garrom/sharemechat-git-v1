// ADR-052 Frente 3 sub-frente 3.C: panel de Tarifa de la modelo.
// Consume los endpoints del sub-frente 3.B (ModelPricingController):
// GET /economics, PUT /pricing, PUT /pro-status.
//
// Iteracion 2 (2026-07-25): tras feedback UX del operador,
//  - selector tarifa pasa a <select> con enteros permitidos por tramo
//    (imposible enviar valores fuera del listado).
//  - cards muestran enteros / EUR limpios sin decimales innecesarios.
//  - se fusiona el tab Progreso: barra de progreso hacia siguiente
//    tramo + tabla referencia T0-T3 se integran aqui abajo.
//  - boton refresh compacto.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import i18n from '../../i18n';
import { apiFetch } from '../../config/http';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTags,
  faArrowRightLong,
  faCircleCheck,
  faCircleExclamation,
  faSpinner,
  faArrowUpRightDots,
  faBullseye,
  faTable,
} from '@fortawesome/free-solid-svg-icons';
import { pricingApi } from '../../api/pricingApi';
import {
  Section,
  SectionHead,
  SectionTitle,
  SectionHint,
  GridCards,
  MiniCard,
  MiniLabel,
  MiniValue,
  MiniMeta,
  StateLine,
  ErrorLine,
  BarWrap,
  BarTrack,
  BarFill,
  BarGlow,
  BarLegend,
  ProgressCard,
  ProgressRow,
  ProgressCol,
  ProgressPercentCol,
  ProgressPercentValue,
  KpiTitle,
  KpiLine,
  TableWrap,
  Table,
} from '../../styles/pages-styles/EstadisticaStyles';
import styled from 'styled-components';

// -------- Estilos locales del panel (mismo lenguaje visual que Estadistica) --------
const InlineRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
`;

const RateSelect = styled.select`
  padding: 8px 12px;
  border-radius: 8px;
  border: 1.5px solid #f4c99b;
  background: #ffffff;
  color: #0f172a;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: #f97316;
    box-shadow: 0 0 0 3px rgba(249,115,22,0.15);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const PrimaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  border-radius: 8px;
  border: 1.5px solid #f97316;
  background: #f97316;
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: filter 0.15s ease;

  &:hover:not(:disabled) {
    filter: brightness(1.06);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const SmallButton = styled.button`
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 6px;
  border: 1.5px solid #94a3b8;
  background: #ffffff;
  color: #334155;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  width: auto;

  &:hover:not(:disabled) {
    background: #f1f5f9;
  }
`;

const Toggle = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-weight: 600;

  input {
    width: 40px;
    height: 20px;
    appearance: none;
    background: #cbd5e1;
    border-radius: 999px;
    position: relative;
    cursor: pointer;
    transition: background 0.15s ease;

    &::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      border-radius: 999px;
      background: #ffffff;
      transition: transform 0.15s ease;
    }

    &:checked {
      background: #f97316;
    }

    &:checked::after {
      transform: translateX(20px);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
`;

const FlashLine = styled.div`
  padding: 10px 14px;
  border-radius: 8px;
  background: ${(p) => (p.$type === 'error' ? 'rgba(229,164,185,0.16)' : 'rgba(163,212,179,0.20)')};
  border: 1px solid ${(p) => (p.$type === 'error' ? 'rgba(229,164,185,0.55)' : 'rgba(163,212,179,0.55)')};
  color: ${(p) => (p.$type === 'error' ? '#b91c1c' : '#166534')};
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
`;

const HintText = styled.div`
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
`;

const CurrentTierRowInTable = styled.tr`
  background: rgba(249, 115, 22, 0.08);
  font-weight: 700;
`;

// -------- Config de tramos: valores enteros permitidos por rango --------
// Los rangos vienen del backend (min/max), aqui solo generamos los enteros
// intermedios inclusive: [min..max] paso 1.
const buildAllowedRates = (min, max) => {
  const mi = Math.round(Number(min));
  const ma = Math.round(Number(max));
  if (!Number.isFinite(mi) || !Number.isFinite(ma) || ma < mi) return [mi].filter(Number.isFinite);
  const out = [];
  for (let v = mi; v <= ma; v++) out.push(v);
  return out;
};

const formatEur0 = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const formatEur2 = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0.00';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatRate = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0';
  // Si es entero, sin decimales; si no, dos decimales.
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

// -------- Referencia estatica de los tramos (para la tabla) --------
// Fuente de verdad: backend model_pricing_tiers (target_type=INDIVIDUAL,
// filas vigentes tras V42+V43). Esta tabla es SOLO REFERENCIA VISUAL —
// el DTO /economics.tierMinBilledGrossEur30d + rateMin/Max + share es
// la fuente autoritativa para renderizar la ficha actual de la modelo.
// Si vuelven a cambiar los tramos en BD, actualizar tambien aqui.
const TIER_REFERENCE = [
  { code: 'T1', minGross: 0,     share: 50, rateMin: 1, rateMax: 1 },
  { code: 'T2', minGross: 1000,  share: 54, rateMin: 1, rateMax: 3 },
  { code: 'T3', minGross: 4000,  share: 57, rateMin: 1, rateMax: 6 },
  { code: 'T4', minGross: 15000, share: 60, rateMin: 1, rateMax: 9 },
];

// ADR-056 Opcion D (2026-08-02): tramos regimen MASTER. Fuente de verdad:
// migracion V42 (seed model_pricing_tiers target_type=MASTER). Solo se
// muestran cuando economics.underMaster=true. No incluyen la columna
// "Estudio recibe %" a proposito (feedback operador iter.3: evitar
// restregar el % en la cara de la modelo — el reparto ya se explica en
// las 3 lineas de arriba).
const TIER_REFERENCE_MASTER = [
  { code: 'T1', minGross: 0,     rateMin: 1, rateMax: 1 },
  { code: 'T2', minGross: 1000,  rateMin: 1, rateMax: 3 },
  { code: 'T3', minGross: 4000,  rateMin: 1, rateMax: 6 },
  { code: 'T4', minGross: 15000, rateMin: 1, rateMax: 9 },
];

// ---------- Componente ----------

export default function ModelPricingPanel() {
  const t = (key, options) => i18n.t(key, options);

  const [economics, setEconomics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rateSelected, setRateSelected] = useState('');
  const [savingRate, setSavingRate] = useState(false);
  const [savingPro, setSavingPro] = useState(false);
  const [flash, setFlash] = useState(null); // { type: 'ok'|'error', message: string }
  // ADR-056 Opcion D iter.4 (2026-08-02): saldo acumulado informativo
  // para el KPI card de la columna derecha en vista Modelo bajo Master.
  // Fetch adicional al endpoint /master-info (que ya devuelve
  // accumulatedNetPactado). Se hace independiente del economics para
  // que el reload local del panel no fuerce a rehacer el cálculo si
  // no cambia el reparto.
  const [accumulatedNet, setAccumulatedNet] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const info = await apiFetch('/models/me/master-info');
        if (!cancelled && info?.hasMaster) {
          setAccumulatedNet(info.accumulatedNetPactado);
        }
      } catch { /* silent: modelo individual no consume el KPI */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadEconomics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await pricingApi.getEconomics();
      setEconomics(data);
      if (data?.chosenRateEurPerMin != null) {
        // Redondeamos al entero mas cercano para casar con las opciones
        // del select (enteros unicamente).
        setRateSelected(String(Math.round(Number(data.chosenRateEurPerMin))));
      }
    } catch (ex) {
      setError(ex?.message || 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEconomics();
  }, [loadEconomics]);

  const rateMin = Number(economics?.rateMinEurPerMin || 0);
  const rateMax = Number(economics?.rateMaxEurPerMin || 0);
  const allowedRates = useMemo(() => buildAllowedRates(rateMin, rateMax), [rateMin, rateMax]);
  const isFixedRate = allowedRates.length <= 1;

  const rateNum = Number(rateSelected);
  const rateUnchanged = useMemo(() => {
    if (!economics?.chosenRateEurPerMin) return false;
    const current = Number(economics.chosenRateEurPerMin);
    return Number.isFinite(rateNum) && Math.abs(current - rateNum) < 0.005;
  }, [economics, rateNum]);

  const handleSaveRate = async () => {
    if (rateUnchanged || savingRate || isFixedRate) return;
    if (!Number.isFinite(rateNum) || !allowedRates.includes(rateNum)) return;
    setSavingRate(true);
    setFlash(null);
    try {
      const updated = await pricingApi.updatePricing(rateNum);
      setEconomics(updated);
      setRateSelected(String(Math.round(Number(updated.chosenRateEurPerMin))));
      setFlash({ type: 'ok', message: t('dashboardModel.pricing.flash.rateOk') });
    } catch (ex) {
      setFlash({ type: 'error', message: ex?.message || t('dashboardModel.pricing.flash.rateError') });
    } finally {
      setSavingRate(false);
    }
  };

  const handleToggleTrial = async (nextValue) => {
    if (savingPro) return;
    setSavingPro(true);
    setFlash(null);
    try {
      const updated = await pricingApi.updateProStatus(nextValue);
      setEconomics(updated);
      setFlash({
        type: 'ok',
        message: nextValue
          ? t('dashboardModel.pricing.flash.proOn')
          : t('dashboardModel.pricing.flash.proOff'),
      });
    } catch (ex) {
      setFlash({ type: 'error', message: ex?.message || t('dashboardModel.pricing.flash.proError') });
    } finally {
      setSavingPro(false);
    }
  };

  if (loading && !economics) {
    return <StateLine>{t('dashboardModel.pricing.status.loading')}</StateLine>;
  }
  if (error && !economics) {
    return <ErrorLine>{t('dashboardModel.pricing.status.error', { error })}</ErrorLine>;
  }
  if (!economics) {
    return null;
  }

  // ADR-056 Opcion D (2026-08-01): rama top-level para modelo bajo
  // Master. Oculta tabla T0-T3 y barra de progreso hacia siguiente
  // tramo (esos escalados afectan al reparto de su Master, no
  // directamente a ella). Sustituye la card "Reparto" opaca por 3
  // lineas transparentes con la formula real: tarifa × %tramo × %pactado.
  if (economics.underMaster) {
    return renderUnderMasterView({
      economics,
      allowedRates,
      isFixedRate,
      rateSelected,
      setRateSelected,
      rateUnchanged,
      savingRate,
      handleSaveRate,
      savingPro,
      handleToggleTrial,
      flash,
      loading,
      loadEconomics,
      rateMin,
      rateMax,
      accumulatedNet,
      t,
    });
  }

  const proEligible = !!economics.proStatusEligible;
  const proAccepts = !!economics.proAcceptsTrial;
  const proMin = Number(economics.proStatusMinBilledGrossEur30d || 1500);
  const billedGross = Number(economics.billedGrossEur30d || 0);
  const nextTier = economics.nextTierCode;
  const nextMin = Number(economics.nextTierMinBilledGrossEur30d || 0);
  const remainingToNext = nextTier ? Math.max(0, nextMin - billedGross) : 0;
  const progressPct = nextTier
    ? Math.max(0, Math.min(100, (billedGross / Math.max(1, nextMin)) * 100))
    : 100;
  // Formato % con 1 decimal (iter.3): evita el "0%" frustrante cuando
  // ya hay algo facturado. Ej: 2,53€ sobre 3500€ = 0,1%.
  const progressPctText = nextTier
    ? progressPct.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : '100';

  return (
    <>
      {flash && (
        <FlashLine $type={flash.type}>
          <FontAwesomeIcon icon={flash.type === 'ok' ? faCircleCheck : faCircleExclamation} />
          {flash.message}
        </FlashLine>
      )}

      {/* SECCIÓN 1 · SNAPSHOT ACTUAL (4 cards limpias sin decimales innecesarios) */}
      <Section>
        <SectionHead>
          <SectionTitle>
            <FontAwesomeIcon icon={faTags} style={{ marginRight: 8 }} />
            {t('dashboardModel.pricing.tier.title')}
          </SectionTitle>
          <SectionHint>{t('dashboardModel.pricing.tier.hint')}</SectionHint>
        </SectionHead>

        <GridCards>
          <MiniCard $accent="blue">
            <MiniLabel>{t('dashboardModel.pricing.cards.tierCode.label')}</MiniLabel>
            <MiniValue>{economics.tierCode || '—'}</MiniValue>
            <MiniMeta>{t('dashboardModel.pricing.cards.tierCode.meta')}</MiniMeta>
          </MiniCard>

          <MiniCard $accent="green">
            <MiniLabel>{t('dashboardModel.pricing.cards.share.label')}</MiniLabel>
            <MiniValue>{formatEur0(economics.modelSharePct)}%</MiniValue>
            <MiniMeta>{t('dashboardModel.pricing.cards.share.meta')}</MiniMeta>
          </MiniCard>

          <MiniCard $accent="amber">
            <MiniLabel>{t('dashboardModel.pricing.cards.billed.label')}</MiniLabel>
            <MiniValue>{formatEur2(billedGross)} €</MiniValue>
            <MiniMeta>{t('dashboardModel.pricing.cards.billed.meta')}</MiniMeta>
          </MiniCard>

          <MiniCard $accent="purple">
            <MiniLabel>{t('dashboardModel.pricing.cards.next.label')}</MiniLabel>
            <MiniValue>
              {nextTier || t('dashboardModel.pricing.cards.next.maxTier')}
            </MiniValue>
            <MiniMeta>
              {nextTier
                ? t('dashboardModel.pricing.cards.next.meta', { threshold: formatEur0(nextMin) })
                : t('dashboardModel.pricing.cards.next.metaMax')}
            </MiniMeta>
          </MiniCard>
        </GridCards>
      </Section>

      {/* SECCIÓN 2 · BARRA DE PROGRESO (fusion del tab Progreso retirado) */}
      <Section>
        <SectionHead>
          <SectionTitle>
            <FontAwesomeIcon icon={faArrowUpRightDots} style={{ marginRight: 8 }} />
            {t('dashboardModel.pricing.progress.title')}
          </SectionTitle>
          <SectionHint>{t('dashboardModel.pricing.progress.hint')}</SectionHint>
        </SectionHead>

        <ProgressCard>
          <ProgressRow>
            <ProgressCol>
              <KpiTitle>{t('dashboardModel.pricing.progress.currentCol.title')}</KpiTitle>
              <KpiLine>
                {t('dashboardModel.pricing.progress.currentCol.tramoLabel')} <b>{economics.tierCode || '—'}</b>
              </KpiLine>
              <KpiLine>
                {t('dashboardModel.pricing.progress.currentCol.billedLabel')} <b>{formatEur2(billedGross)} €</b>
              </KpiLine>
            </ProgressCol>

            <ProgressCol>
              <KpiTitle>{t('dashboardModel.pricing.progress.nextCol.title')}</KpiTitle>
              {nextTier ? (
                <>
                  <KpiLine>
                    {t('dashboardModel.pricing.progress.nextCol.tramoLabel')} <b>{nextTier}</b>
                  </KpiLine>
                  <KpiLine>
                    {t('dashboardModel.pricing.progress.nextCol.requirementLabel')} <b>{formatEur0(nextMin)} €</b>
                  </KpiLine>
                  <KpiLine>
                    {t('dashboardModel.pricing.progress.nextCol.remainingLabel')} <b>{formatEur2(remainingToNext)} €</b>
                  </KpiLine>
                </>
              ) : (
                <KpiLine>{t('dashboardModel.pricing.progress.nextCol.maxTier')}</KpiLine>
              )}
            </ProgressCol>

            {nextTier && (
              <ProgressPercentCol>
                <ProgressPercentValue>{progressPctText}%</ProgressPercentValue>
              </ProgressPercentCol>
            )}
          </ProgressRow>

          <BarWrap>
            <BarTrack>
              <BarFill style={{ width: `${progressPct}%` }} />
              <BarGlow style={{ width: `${progressPct}%` }} />
            </BarTrack>

            <BarLegend>
              <span>{formatEur2(billedGross)} €</span>
              <span>{nextTier ? `${formatEur0(nextMin)} €` : '—'}</span>
            </BarLegend>
          </BarWrap>
        </ProgressCard>
      </Section>

      {/* SECCIÓN 3 · SELECTOR DE TARIFA */}
      <Section>
        <SectionHead>
          <SectionTitle>
            <FontAwesomeIcon icon={faArrowRightLong} style={{ marginRight: 8 }} />
            {t('dashboardModel.pricing.rate.title')}
          </SectionTitle>
          <SectionHint>
            {isFixedRate
              ? t('dashboardModel.pricing.rate.fixedHint', { tier: economics.tierCode })
              : t('dashboardModel.pricing.rate.hint', {
                  min: formatRate(rateMin),
                  max: formatRate(rateMax),
                })}
          </SectionHint>
        </SectionHead>

        <InlineRow>
          <span style={{ fontWeight: 700, color: '#334155' }}>
            {t('dashboardModel.pricing.rate.label')}:
          </span>
          <RateSelect
            value={rateSelected}
            onChange={(e) => setRateSelected(e.target.value)}
            disabled={savingRate || isFixedRate}
          >
            {allowedRates.map((v) => (
              <option key={v} value={String(v)}>
                {v} €/min
              </option>
            ))}
          </RateSelect>
          <PrimaryButton
            type="button"
            onClick={handleSaveRate}
            disabled={rateUnchanged || savingRate || isFixedRate}
          >
            {savingRate && <FontAwesomeIcon icon={faSpinner} spin />}
            {t('dashboardModel.pricing.rate.saveButton')}
          </PrimaryButton>
        </InlineRow>
      </Section>

      {/* SECCIÓN 4 · ESTATUS PRO */}
      <Section>
        <SectionHead>
          <SectionTitle>
            <FontAwesomeIcon icon={faCircleCheck} style={{ marginRight: 8 }} />
            {t('dashboardModel.pricing.pro.title')}
          </SectionTitle>
          <SectionHint>
            {proEligible
              ? t('dashboardModel.pricing.pro.hintActive')
              : t('dashboardModel.pricing.pro.hintInactive', {
                  threshold: formatEur0(proMin),
                  remaining: formatEur2(Math.max(0, proMin - billedGross)),
                })}
          </SectionHint>
        </SectionHead>

        <InlineRow>
          <Toggle>
            <input
              type="checkbox"
              checked={proAccepts}
              disabled={!proEligible || savingPro}
              onChange={(e) => handleToggleTrial(e.target.checked)}
            />
            <span>{t('dashboardModel.pricing.pro.acceptTrialLabel')}</span>
          </Toggle>
          {savingPro && <FontAwesomeIcon icon={faSpinner} spin style={{ color: '#f97316' }} />}
        </InlineRow>

        <HintText style={{ marginTop: 8 }}>
          {t('dashboardModel.pricing.pro.explainer')}
        </HintText>
      </Section>

      {/* SECCIÓN 5 · TABLA REFERENCIA T0-T3 */}
      <Section>
        <SectionHead>
          <SectionTitle>
            <FontAwesomeIcon icon={faTable} style={{ marginRight: 8 }} />
            {t('dashboardModel.pricing.reference.title')}
          </SectionTitle>
          <SectionHint>{t('dashboardModel.pricing.reference.hint')}</SectionHint>
        </SectionHead>

        <TableWrap>
          <Table>
            <thead>
              <tr>
                <th>{t('dashboardModel.pricing.reference.headers.tier')}</th>
                <th style={{ textAlign: 'right' }}>
                  {t('dashboardModel.pricing.reference.headers.threshold')}
                </th>
                <th style={{ textAlign: 'right' }}>
                  {t('dashboardModel.pricing.reference.headers.share')}
                </th>
                <th style={{ textAlign: 'right' }}>
                  {t('dashboardModel.pricing.reference.headers.rateRange')}
                </th>
              </tr>
            </thead>
            <tbody>
              {TIER_REFERENCE.map((tier) => {
                const isCurrent = tier.code === economics.tierCode;
                const RowComp = isCurrent ? CurrentTierRowInTable : 'tr';
                const rangeText = tier.rateMin === tier.rateMax
                  ? `${tier.rateMin} €/min`
                  : `${tier.rateMin} – ${tier.rateMax} €/min`;
                return (
                  <RowComp key={tier.code}>
                    <td className="name">
                      {tier.code}
                      {isCurrent && (
                        <span style={{ marginLeft: 8, color: '#f97316', fontWeight: 700 }}>
                          {t('dashboardModel.pricing.reference.youAreHere')}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {tier.minGross === 0 ? '—' : `${formatEur0(tier.minGross)} €`}
                    </td>
                    <td style={{ textAlign: 'right' }}>{tier.share}%</td>
                    <td style={{ textAlign: 'right' }}>{rangeText}</td>
                  </RowComp>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      </Section>

      <SmallButton type="button" onClick={loadEconomics} disabled={loading}>
        {t('dashboardModel.pricing.reloadButton')}
      </SmallButton>
    </>
  );
}

// ============================================================
// ADR-056 Opcion D (2026-08-01): vista dedicada Modelo bajo Master.
// Rama top-level del componente principal; comparte estilos, handlers
// y estado con la vista individual (paso todo por props). Mantiene:
//   - Selector Tarifa (input operativo suyo, ADR-056 D3).
//   - Estatus PRO (toggle trials, sigue siendo suya).
// Reemplaza:
//   - Card "Reparto" opaca por 3 lineas transparentes con formula real.
// Oculta:
//   - Tabla T0-T3 (INDIVIDUAL, irrelevante para su reparto).
//   - Barra de progreso hacia siguiente tramo (afecta al Master).
//   - Card tramo (T1-T4) y card facturacion 30d (idem).
// ============================================================
function renderUnderMasterView({
  economics, allowedRates, isFixedRate, rateSelected, setRateSelected,
  rateUnchanged, savingRate, handleSaveRate, savingPro, handleToggleTrial,
  flash, loading, loadEconomics, rateMin, rateMax, accumulatedNet, t,
}) {
  const proEligible = !!economics.proStatusEligible;
  const proAccepts = !!economics.proAcceptsTrial;
  const proMin = Number(economics.proStatusMinBilledGrossEur30d || 1500);
  const billedGross = Number(economics.billedGrossEur30d || 0);

  const chosenRate = Number(economics.chosenRateEurPerMin || 0);
  const tramoPct = Number(economics.modelSharePct || 0);       // % que Master recibe del bruto
  const pactadoPct = Number(economics.internalSharePct || 0);  // % que Master paga a modelo
  const masterEurPerMin = chosenRate * (tramoPct / 100);
  const netoPorMinuto = masterEurPerMin * (pactadoPct / 100);

  const masterName = economics.masterDisplayName || t('dashboardModel.pricing.underMaster.fallbackName');
  const currentTierCode = economics.tierCode || 'T1';

  // Iter.4 (2026-08-02): layout 2 columnas (desktop >=1024px) → columna
  // izquierda ancha con reparto + tabla T1-T4, columna derecha estrecha
  // con KPI neto acumulado + tarifa + Pro. Apilado vertical en móvil.
  const boxRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0' };
  const kpiCard = { background: '#f1f5f9', padding: '14px 16px', borderRadius: 8 };
  const kpiLabel = { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 };
  const kpiValue = { fontSize: 24, fontWeight: 700, color: '#0f172a', margin: '4px 0 0' };
  const kpiHint = { fontSize: 11, color: '#94a3b8', marginTop: 6, lineHeight: 1.4 };

  return (
    <div className="mp-under-master-grid">
      <style>{`
        .mp-under-master-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 24px;
          align-items: start;
        }
        @media (min-width: 1024px) {
          .mp-under-master-grid {
            grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
          }
        }
        .mp-col { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
      `}</style>

      {flash && (
        <div style={{ gridColumn: '1 / -1' }}>
          <FlashLine $type={flash.type}>
            <FontAwesomeIcon icon={flash.type === 'ok' ? faCircleCheck : faCircleExclamation} />
            {flash.message}
          </FlashLine>
        </div>
      )}

      {/* ============================================================
          COLUMNA IZQUIERDA — reparto + tabla T1-T4
          ============================================================ */}
      <div className="mp-col">
        <Section>
          <SectionHead>
            <SectionTitle>
              <FontAwesomeIcon icon={faTags} style={{ marginRight: 8 }} />
              {t('dashboardModel.pricing.underMaster.title')}
            </SectionTitle>
            <SectionHint>
              {t('dashboardModel.pricing.underMaster.hint', { name: masterName })}
            </SectionHint>
          </SectionHead>

          <div style={{
            background: '#e0e7ff', border: '1px solid #a5b4fc', borderRadius: 0,
            padding: '14px 16px', color: '#3730a3', fontSize: 13, lineHeight: 1.6,
          }}>
            <div style={boxRow}>
              <span><b>{t('dashboardModel.pricing.underMaster.line1', { tier: currentTierCode })}</b></span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatEur2(chosenRate)} €/min</span>
            </div>
            <div style={boxRow}>
              <span>{t('dashboardModel.pricing.underMaster.line2', { tramo: formatEur0(tramoPct), tier: currentTierCode })}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatEur2(masterEurPerMin)} €/min</span>
            </div>
            <div style={{ ...boxRow, borderTop: '1px solid #a5b4fc', marginTop: 6, paddingTop: 8 }}>
              <span><b>{t('dashboardModel.pricing.underMaster.line3', { pactado: formatEur0(pactadoPct), tramo: formatEur0(tramoPct), tier: currentTierCode })}</b></span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{formatEur2(netoPorMinuto)} €/min</span>
            </div>
          </div>
        </Section>

        <Section>
          <SectionHead>
            <SectionTitle>
              <FontAwesomeIcon icon={faTable} style={{ marginRight: 8 }} />
              {t('dashboardModel.pricing.underMaster.tiersTitle')}
            </SectionTitle>
            <SectionHint>{t('dashboardModel.pricing.underMaster.tiersHint')}</SectionHint>
          </SectionHead>

          <TableWrap style={{ borderRadius: 0 }}>
            <Table>
              <thead>
                <tr>
                  <th>{t('dashboardModel.pricing.underMaster.headers.tier')}</th>
                  <th style={{ textAlign: 'right' }}>{t('dashboardModel.pricing.underMaster.headers.threshold')}</th>
                  <th style={{ textAlign: 'right' }}>{t('dashboardModel.pricing.underMaster.headers.rateRange')}</th>
                </tr>
              </thead>
              <tbody>
                {TIER_REFERENCE_MASTER.map((tier) => {
                  const isCurrent = tier.code === currentTierCode;
                  const RowComp = isCurrent ? CurrentTierRowInTable : 'tr';
                  const rangeText = tier.rateMin === tier.rateMax
                    ? `${tier.rateMin} €/min`
                    : `${tier.rateMin} – ${tier.rateMax} €/min`;
                  return (
                    <RowComp key={tier.code}>
                      <td className="name">
                        {tier.code}
                        {isCurrent && (
                          <span style={{ marginLeft: 8, color: '#f97316', fontWeight: 700 }}>
                            {t('dashboardModel.pricing.reference.youAreHere')}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {tier.minGross === 0 ? '—' : `${formatEur0(tier.minGross)} €`}
                      </td>
                      <td style={{ textAlign: 'right' }}>{rangeText}</td>
                    </RowComp>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </Section>
      </div>

      {/* ============================================================
          COLUMNA DERECHA — KPI neto acumulado + Tarifa + Pro
          ============================================================ */}
      <div className="mp-col">
        <div style={kpiCard}>
          <div style={kpiLabel}>{t('dashboardModel.pricing.underMaster.kpi.label')}</div>
          <div style={kpiValue}>
            {accumulatedNet != null ? `${formatEur2(accumulatedNet)} €` : '—'}
          </div>
          <div style={kpiHint}>{t('dashboardModel.pricing.underMaster.kpi.hint')}</div>
        </div>

        <Section>
          <SectionHead>
            <SectionTitle>
              <FontAwesomeIcon icon={faArrowRightLong} style={{ marginRight: 8 }} />
              {t('dashboardModel.pricing.rate.title')}
            </SectionTitle>
            <SectionHint>
              {isFixedRate
                ? t('dashboardModel.pricing.rate.fixedHint', { tier: economics.tierCode })
                : t('dashboardModel.pricing.rate.hint', {
                    min: formatRate(rateMin),
                    max: formatRate(rateMax),
                  })}
            </SectionHint>
          </SectionHead>

          <InlineRow>
            <span style={{ fontWeight: 700, color: '#334155' }}>
              {t('dashboardModel.pricing.rate.label')}:
            </span>
            <RateSelect
              value={rateSelected}
              onChange={(e) => setRateSelected(e.target.value)}
              disabled={savingRate || isFixedRate}
            >
              {allowedRates.map((v) => (
                <option key={v} value={String(v)}>
                  {v} €/min
                </option>
              ))}
            </RateSelect>
            <PrimaryButton
              type="button"
              onClick={handleSaveRate}
              disabled={rateUnchanged || savingRate || isFixedRate}
            >
              {savingRate && <FontAwesomeIcon icon={faSpinner} spin />}
              {t('dashboardModel.pricing.rate.saveButton')}
            </PrimaryButton>
          </InlineRow>
        </Section>

        <Section>
          <SectionHead>
            <SectionTitle>
              <FontAwesomeIcon icon={faCircleCheck} style={{ marginRight: 8 }} />
              {t('dashboardModel.pricing.pro.title')}
            </SectionTitle>
            <SectionHint>
              {proEligible
                ? t('dashboardModel.pricing.pro.hintActive')
                : t('dashboardModel.pricing.pro.hintInactive', {
                    threshold: formatEur0(proMin),
                    remaining: formatEur2(Math.max(0, proMin - billedGross)),
                  })}
            </SectionHint>
          </SectionHead>

          <InlineRow>
            <Toggle>
              <input
                type="checkbox"
                checked={proAccepts}
                disabled={!proEligible || savingPro}
                onChange={(e) => handleToggleTrial(e.target.checked)}
              />
              <span>{t('dashboardModel.pricing.pro.acceptTrialLabel')}</span>
            </Toggle>
            {savingPro && <FontAwesomeIcon icon={faSpinner} spin style={{ color: '#f97316' }} />}
          </InlineRow>

          <HintText style={{ marginTop: 8 }}>
            {t('dashboardModel.pricing.pro.explainer')}
          </HintText>
        </Section>

        <SmallButton type="button" onClick={loadEconomics} disabled={loading}>
          {t('dashboardModel.pricing.reloadButton')}
        </SmallButton>
      </div>
    </div>
  );
}
