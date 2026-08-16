// src/pages/admin/audit/AuditBfpmPanel.jsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  CardsGrid,
  NoteCard,
  StatCard,
  StyledButton,
  StyledError,
  StyledTable,
} from '../../../styles/AdminStyles';

/**
 * BFPM Fase 4B-b — resumen backoffice del bonus financiado por plataforma (ADR-012).
 * Read-only: consume GET /api/admin/audit/bfpm-summary (no dispara audit ni escribe).
 * Muestra la invariante actual (Σ BONUS_GRANT + Σ BONUS_FUNDING ≈ 0), el bonus emitido /
 * financiado, el número de pares y las anomalías vivas (huérfanos + mismatch total_pagos).
 */
const AuditBfpmPanel = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/audit/bfpm-summary?limit=50', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error((await res.text()) || 'No se pudo cargar el resumen BFPM');
      const json = await res.json();
      setData(json || null);
    } catch (e) {
      setError(e.message || 'No se pudo cargar el resumen BFPM');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const fmtEur = (v) => {
    if (v === null || v === undefined || v === '') return '—';
    const n = Number(v);
    if (Number.isNaN(n)) return String(v);
    return `${n.toFixed(2)} €`;
  };

  const grants = Array.isArray(data?.grantsWithoutFunding) ? data.grantsWithoutFunding : [];
  const fundings = Array.isArray(data?.fundingsWithoutGrant) ? data.fundingsWithoutGrant : [];
  const mismatch = Array.isArray(data?.totalPagosMismatch) ? data.totalPagosMismatch : [];
  const anomalyCount = grants.length + fundings.length + mismatch.length;
  const invariantOk = data?.invariantOk === true;

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <StyledButton onClick={load} disabled={loading}>
          {loading ? 'Cargando…' : 'Recargar resumen'}
        </StyledButton>
        {error && <StyledError style={{ margin: 0 }}>{error}</StyledError>}
      </div>

      <CardsGrid>
        <StatCard>
          <div className="label">Invariante BFPM</div>
          <div className="value" style={{ color: invariantOk ? '#1f9d55' : '#c0392b' }}>
            {data ? (invariantOk ? 'OK' : 'DESCUADRE') : '—'}
          </div>
          <div className="meta">
            Σ BONUS_GRANT + Σ BONUS_FUNDING = <strong>{data ? fmtEur(data.invariantDelta) : '—'}</strong>
            <br />
            (esperado 0 €, tolerancia 0,01 €)
          </div>
        </StatCard>

        <StatCard>
          <div className="label">Bonus emitido (cliente)</div>
          <div className="value">{data ? fmtEur(data.sumBonusGrant) : '—'}</div>
          <div className="meta">Σ transactions.op = BONUS_GRANT</div>
        </StatCard>

        <StatCard>
          <div className="label">Bonus financiado (plataforma)</div>
          <div className="value">{data ? fmtEur(data.sumBonusFunding) : '—'}</div>
          <div className="meta">Σ platform_transactions.op = BONUS_FUNDING</div>
        </StatCard>

        <StatCard>
          <div className="label">Pares BFPM emitidos</div>
          <div className="value">{data ? (data.bonusPairCount ?? 0) : '—'}</div>
          <div className="meta">nº de asientos BONUS_GRANT con su contrapartida</div>
        </StatCard>
      </CardsGrid>

      <div style={{ marginTop: 16 }}>
        {data && anomalyCount === 0 && (
          <NoteCard $muted>
            <div className="label">Sin anomalías BFPM</div>
            <div className="meta">
              No hay huérfanos (grant sin funding ni viceversa) ni descuadres de total_pagos.
            </div>
          </NoteCard>
        )}

        {grants.length > 0 && (
          <StatCard style={{ marginTop: 12 }}>
            <div className="label">BONUS_GRANT sin BONUS_FUNDING ({grants.length})</div>
            <div style={{ overflowX: 'auto', marginTop: 8 }}>
              <StyledTable>
                <thead>
                  <tr><th>Tx</th><th>User</th><th>Importe</th><th>Descripción</th></tr>
                </thead>
                <tbody>
                  {grants.map((r) => (
                    <tr key={`g-${r.transactionId}`}>
                      <td>{r.transactionId ?? '—'}</td>
                      <td>{r.userId ?? '—'}</td>
                      <td>{fmtEur(r.amount)}</td>
                      <td title={r.description || ''}>{r.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </StyledTable>
            </div>
          </StatCard>
        )}

        {fundings.length > 0 && (
          <StatCard style={{ marginTop: 12 }}>
            <div className="label">BONUS_FUNDING sin BONUS_GRANT ({fundings.length})</div>
            <div style={{ overflowX: 'auto', marginTop: 8 }}>
              <StyledTable>
                <thead>
                  <tr><th>PlatformTx</th><th>Importe</th><th>Descripción</th></tr>
                </thead>
                <tbody>
                  {fundings.map((r) => (
                    <tr key={`f-${r.platformTransactionId}`}>
                      <td>{r.platformTransactionId ?? '—'}</td>
                      <td>{fmtEur(r.amount)}</td>
                      <td title={r.description || ''}>{r.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </StyledTable>
            </div>
          </StatCard>
        )}

        {mismatch.length > 0 && (
          <StatCard style={{ marginTop: 12 }}>
            <div className="label">Descuadre total_pagos vs Σ INGRESO ({mismatch.length})</div>
            <div style={{ overflowX: 'auto', marginTop: 8 }}>
              <StyledTable>
                <thead>
                  <tr><th>User</th><th>total_pagos</th><th>Σ INGRESO</th><th>Δ</th></tr>
                </thead>
                <tbody>
                  {mismatch.map((r) => (
                    <tr key={`m-${r.userId}`}>
                      <td>{r.userId ?? '—'}</td>
                      <td>{fmtEur(r.totalPagos)}</td>
                      <td>{fmtEur(r.sumIngreso)}</td>
                      <td>{fmtEur(r.delta)}</td>
                    </tr>
                  ))}
                </tbody>
              </StyledTable>
            </div>
          </StatCard>
        )}
      </div>
    </div>
  );
};

export default AuditBfpmPanel;
