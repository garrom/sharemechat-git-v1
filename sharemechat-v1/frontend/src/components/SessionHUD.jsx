// HUD de sesión activa (videochat) mostrado sobre el vídeo remoto.
//
// ADR-052 Superficie 2 (2026-07-25): coste por minuto visible + cronómetro
// vivo durante la sesión. Backend NO factura por minuto (StreamService.endSession
// aplica el cargo al colgar), así que este HUD es 100% cálculo local:
//   consumido_estimado = elapsedSec * ratePerMin / 60
//   saldo_estimado     = baseBalance - consumido_estimado
// Regalos: cliente recibe newBalance vía WS al enviarlo; entonces se
// re-snapshotea baseBalance para no seguir restando desde el punto
// anterior. Modelo suma giftsSum (calculado por el llamador con el % del
// tramo aplicado) al ganado por tiempo.
//
// Solo se pinta cuando active === true. Al desactivar limpia estado.

import React, { useEffect, useRef, useState } from 'react';
import i18n from '../i18n';

const fmt2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : '0.00');

const fmtMMSS = (totalSec) => {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};

export default function SessionHUD({
  variant,
  active,
  ratePerMin,
  baseBalance,
  externalBalance,
  modelSharePct,
  giftsSum,
}) {
  const [elapsedSec, setElapsedSec] = useState(0);
  const [snapshot, setSnapshot] = useState(null); // { balance, atSec }
  const startedAtRef = useRef(null);
  const tickRef = useRef(null);
  const lastExternalRef = useRef(null);

  useEffect(() => {
    if (!active) {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      startedAtRef.current = null;
      setElapsedSec(0);
      setSnapshot(null);
      lastExternalRef.current = null;
      return;
    }
    if (!startedAtRef.current) {
      startedAtRef.current = Date.now();
      setElapsedSec(0);
      if (variant === 'client' && Number.isFinite(Number(baseBalance))) {
        setSnapshot({ balance: Number(baseBalance), atSec: 0 });
      }
    }
    if (!tickRef.current) {
      tickRef.current = setInterval(() => {
        const started = startedAtRef.current;
        if (!started) return;
        setElapsedSec(Math.floor((Date.now() - started) / 1000));
      }, 1000);
    }
    return () => {
      if (!active && tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [active, variant, baseBalance]);

  useEffect(() => {
    if (!active || variant !== 'client') return;
    if (externalBalance == null) return;
    if (lastExternalRef.current === externalBalance) return;
    lastExternalRef.current = externalBalance;
    setSnapshot({ balance: Number(externalBalance), atSec: elapsedSec });
  }, [externalBalance, active, variant, elapsedSec]);

  if (!active) return null;

  const rate = Number(ratePerMin);
  const rateValid = Number.isFinite(rate) && rate > 0;
  const consumidoDesdeSnapshot = rateValid && snapshot
    ? ((elapsedSec - snapshot.atSec) * rate) / 60
    : 0;

  // Posicion: overlay bajo el topbar (StyledCallTopMeta ocupa la esquina
  // superior izquierda con el nickname del peer + avatar; el HUD se
  // coloca justo debajo para no solaparse). z-index alto para pisar el
  // video y competir con TrialBadge del modelo (z-index 20).
  const containerStyle = {
    position: 'absolute',
    top: 60,
    left: 12,
    zIndex: 25,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 12,
    padding: '6px 12px',
    borderRadius: 999,
    background: 'rgba(0, 0, 0, 0.72)',
    color: '#f9fafb',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '0.92rem',
    fontWeight: 600,
    letterSpacing: '0.02em',
    pointerEvents: 'none',
    userSelect: 'none',
    boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
  };

  const dotStyle = {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#ef4444',
    boxShadow: '0 0 8px rgba(239,68,68,0.7)',
  };

  const sepStyle = { opacity: 0.35 };
  const t = (k, o) => i18n.t(k, o);

  if (variant === 'client') {
    const saldoEstimado = snapshot ? snapshot.balance - consumidoDesdeSnapshot : NaN;
    return (
      <div style={containerStyle} data-testid="session-hud-client">
        <span style={dotStyle} />
        <span>{fmtMMSS(elapsedSec)}</span>
        <span style={sepStyle}>·</span>
        <span title={t('sessionHUD.client.rateTitle')}>
          {rateValid ? t('common.ratePerMin', { rate: fmt2(rate) }) : '—'}
        </span>
        <span style={sepStyle}>·</span>
        <span title={t('sessionHUD.client.balanceTitle')}>
          {Number.isFinite(saldoEstimado)
            ? `${fmt2(saldoEstimado)} €`
            : '—'}
        </span>
      </div>
    );
  }

  const pct = Number(modelSharePct);
  const pctValid = Number.isFinite(pct) && pct > 0;
  const ganadoPorTiempo = (rateValid && pctValid)
    ? (elapsedSec * rate * pct) / 6000
    : 0;
  const ganadoTotal = ganadoPorTiempo + (Number.isFinite(giftsSum) ? Number(giftsSum) : 0);

  return (
    <div style={containerStyle} data-testid="session-hud-model">
      <span style={dotStyle} />
      <span>{fmtMMSS(elapsedSec)}</span>
      <span style={sepStyle}>·</span>
      <span title={t('sessionHUD.model.earningsTitle')}>
        {`+${fmt2(ganadoTotal)} €`}
      </span>
      {Number.isFinite(giftsSum) && giftsSum > 0 && (
        <>
          <span style={sepStyle}>·</span>
          <span title={t('sessionHUD.model.giftsTitle')}>
            {t('sessionHUD.model.giftsLabel', { amount: fmt2(giftsSum) })}
          </span>
        </>
      )}
    </div>
  );
}
