// ADR-052 Frente 3 sub-frente 3.C: panel de Tarifa de la modelo.
// Consume los endpoints del sub-frente 3.B (ModelPricingController):
// GET /economics, PUT /pricing, PUT /pro-status.
//
// UX:
//  - Card tramo actual con codigo, %reparto, facturacion bruta rolling
//    30d y siguiente objetivo (o "tramo maximo" si esta en T3).
//  - Card rango de precio con selector de tarifa (input dentro del rango
//    con validacion cliente + boton Guardar).
//  - Card Estatus Pro cuando la modelo cumple el umbral (default 1500 EUR
//    facturacion bruta 30d). Toggle "aceptar clientes trial" persistido
//    aunque Pro no sea elegible (preserva preferencia futura).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import i18n from '../../i18n';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTags,
  faArrowRightLong,
  faCircleCheck,
  faCircleExclamation,
  faSpinner,
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
} from '../../styles/pages-styles/EstadisticaStyles';
import styled from 'styled-components';

// -------- Estilos locales del panel (mismo lenguaje visual que Estadistica) --------
const InlineRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
`;

const RateInput = styled.input`
  width: 120px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1.5px solid #f4c99b;
  background: #ffffff;
  color: #0f172a;
  font-size: 15px;
  font-weight: 600;
  text-align: right;

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

const SecondaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1.5px solid #94a3b8;
  background: #ffffff;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

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

// ---------- Componente ----------

export default function ModelPricingPanel() {
  const t = (key, options) => i18n.t(key, options);

  const [economics, setEconomics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rateInput, setRateInput] = useState('');
  const [savingRate, setSavingRate] = useState(false);
  const [savingPro, setSavingPro] = useState(false);
  const [flash, setFlash] = useState(null); // { type: 'ok'|'error', message: string }

  const loadEconomics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await pricingApi.getEconomics();
      setEconomics(data);
      if (data?.chosenRateEurPerMin != null) {
        setRateInput(Number(data.chosenRateEurPerMin).toFixed(2));
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

  const rateNum = useMemo(() => {
    const n = Number(String(rateInput).replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  }, [rateInput]);

  const rateMin = Number(economics?.rateMinEurPerMin || 0);
  const rateMax = Number(economics?.rateMaxEurPerMin || 0);

  const rateInRange = useMemo(() => {
    if (!Number.isFinite(rateNum)) return false;
    return rateNum >= rateMin && rateNum <= rateMax;
  }, [rateNum, rateMin, rateMax]);

  const rateUnchanged = useMemo(() => {
    if (!economics?.chosenRateEurPerMin) return false;
    const current = Number(economics.chosenRateEurPerMin);
    return Number.isFinite(rateNum) && Math.abs(current - rateNum) < 0.005;
  }, [economics, rateNum]);

  const handleSaveRate = async () => {
    if (!rateInRange || rateUnchanged || savingRate) return;
    setSavingRate(true);
    setFlash(null);
    try {
      const updated = await pricingApi.updatePricing(rateNum);
      setEconomics(updated);
      setRateInput(Number(updated.chosenRateEurPerMin).toFixed(2));
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

  const proEligible = !!economics.proStatusEligible;
  const proAccepts = !!economics.proAcceptsTrial;
  const proMin = Number(economics.proStatusMinBilledGrossEur30d || 1500);
  const billedGross = Number(economics.billedGrossEur30d || 0);
  const nextTier = economics.nextTierCode;
  const nextMin = Number(economics.nextTierMinBilledGrossEur30d || 0);
  const remainingToNext = nextTier ? Math.max(0, nextMin - billedGross) : 0;

  return (
    <>
      {flash && (
        <FlashLine $type={flash.type}>
          <FontAwesomeIcon icon={flash.type === 'ok' ? faCircleCheck : faCircleExclamation} />
          {flash.message}
        </FlashLine>
      )}

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
            <MiniValue>
              {Number(economics.modelSharePct || 0).toFixed(0)}%
            </MiniValue>
            <MiniMeta>{t('dashboardModel.pricing.cards.share.meta')}</MiniMeta>
          </MiniCard>

          <MiniCard $accent="amber">
            <MiniLabel>{t('dashboardModel.pricing.cards.billed.label')}</MiniLabel>
            <MiniValue>{billedGross.toFixed(2)} €</MiniValue>
            <MiniMeta>{t('dashboardModel.pricing.cards.billed.meta')}</MiniMeta>
          </MiniCard>

          <MiniCard $accent="purple">
            <MiniLabel>{t('dashboardModel.pricing.cards.next.label')}</MiniLabel>
            <MiniValue>
              {nextTier
                ? t('dashboardModel.pricing.cards.next.value', {
                    tier: nextTier,
                    remaining: remainingToNext.toFixed(2),
                  })
                : t('dashboardModel.pricing.cards.next.maxTier')}
            </MiniValue>
            <MiniMeta>
              {nextTier
                ? t('dashboardModel.pricing.cards.next.meta', { threshold: nextMin.toFixed(0) })
                : t('dashboardModel.pricing.cards.next.metaMax')}
            </MiniMeta>
          </MiniCard>
        </GridCards>
      </Section>

      <Section>
        <SectionHead>
          <SectionTitle>
            <FontAwesomeIcon icon={faArrowRightLong} style={{ marginRight: 8 }} />
            {t('dashboardModel.pricing.rate.title')}
          </SectionTitle>
          <SectionHint>
            {t('dashboardModel.pricing.rate.hint', {
              min: rateMin.toFixed(2),
              max: rateMax.toFixed(2),
            })}
          </SectionHint>
        </SectionHead>

        <InlineRow>
          <span style={{ fontWeight: 700, color: '#334155' }}>
            {t('dashboardModel.pricing.rate.label')}:
          </span>
          <RateInput
            type="number"
            step="0.01"
            min={rateMin}
            max={rateMax}
            value={rateInput}
            onChange={(e) => setRateInput(e.target.value)}
            disabled={savingRate || rateMin === rateMax}
          />
          <span style={{ color: '#64748b' }}>€/min</span>
          <PrimaryButton
            type="button"
            onClick={handleSaveRate}
            disabled={!rateInRange || rateUnchanged || savingRate || rateMin === rateMax}
          >
            {savingRate && <FontAwesomeIcon icon={faSpinner} spin />}
            {t('dashboardModel.pricing.rate.saveButton')}
          </PrimaryButton>
        </InlineRow>

        {rateMin === rateMax && (
          <HintText style={{ marginTop: 8 }}>
            {t('dashboardModel.pricing.rate.fixedHint', { tier: economics.tierCode })}
          </HintText>
        )}
        {rateMin !== rateMax && !rateInRange && rateInput !== '' && (
          <HintText style={{ marginTop: 8, color: '#b91c1c' }}>
            {t('dashboardModel.pricing.rate.outOfRange', {
              min: rateMin.toFixed(2),
              max: rateMax.toFixed(2),
            })}
          </HintText>
        )}
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
                  threshold: proMin.toFixed(0),
                  remaining: Math.max(0, proMin - billedGross).toFixed(2),
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

      <SecondaryButton type="button" onClick={loadEconomics} disabled={loading}>
        {t('dashboardModel.pricing.reloadButton')}
      </SecondaryButton>
    </>
  );
}
