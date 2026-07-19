// Panel "Historial" del dashboard cliente (2026-07-19 Fase 1).
// Consume GET /api/clients/me/transactions?type=INGRESO&page=&size=.
// Solo recargas en esta fase; Fase 2 anadira filtro por tipo para
// mostrar consumo (STREAM_CHARGE), regalos y bonos.

import React, { useCallback, useEffect, useState } from 'react';
import i18n from '../../i18n';
import { apiFetch } from '../../config/http';

const wrap = { padding: '20px 24px', maxWidth: 900 };
const headerRow = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' };
const btn = (variant = 'primary', disabled = false) => ({
  padding: '8px 16px', borderRadius: 8, border: 'none',
  background: disabled ? '#c9d1d9' : variant === 'primary' ? '#2f81f7' : '#e6edf3',
  color: variant === 'primary' ? '#ffffff' : '#1a1f2e',
  fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
});
const title = { fontSize: 20, fontWeight: 700, color: '#18212f', margin: 0 };
const subtitle = { fontSize: 13, color: '#6b7280', marginTop: 4 };
const table = { width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff', border: '1px solid #e1e4e8', borderRadius: 8, overflow: 'hidden' };
const th = { textAlign: 'left', padding: '10px 12px', background: '#f4f6f9', color: '#3a4152', fontWeight: 600, borderBottom: '1px solid #e1e4e8' };
const td = { padding: '10px 12px', borderBottom: '1px solid #eef1f4', color: '#18212f' };
const tdAmount = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 };
const empty = { padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 13 };
const errBox = { padding: 12, background: '#fde7e9', borderRadius: 8, color: '#b3261e', border: '1px solid #f5c2c7', marginBottom: 12, fontSize: 13 };
const pager = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12, fontSize: 13, color: '#6b7280' };

const PAGE_SIZE = 20;

const fmtDate = (iso) => {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toISOString().slice(0, 16).replace('T', ' ');
  } catch { return String(iso); }
};

const fmtEUR = (n) => {
  const v = Number(n);
  if (!isFinite(v)) return '-';
  return `${v.toFixed(2)} EUR`;
};

// El backend guarda descriptions tipo "Recarga via NOWPAYMENTS pack=P10
// order=32ef33a0-...". Extraemos pack y order para columnas dedicadas;
// si no coinciden mostramos la description entera como fallback.
const parseDescription = (desc) => {
  if (!desc) return { pack: null, orderShort: null, raw: null };
  const packMatch = desc.match(/pack=([A-Z0-9]+)/i);
  const orderMatch = desc.match(/order=([a-f0-9-]{8,})/i);
  return {
    pack: packMatch ? packMatch[1] : null,
    orderShort: orderMatch ? orderMatch[1].slice(0, 8) : null,
    raw: (!packMatch && !orderMatch) ? desc : null,
  };
};

const ClientHistoryPanel = () => {
  const t = useCallback((key, options) => i18n.t(key, options), []);
  const [data, setData] = useState(null);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (pageArg) => {
    setBusy(true);
    setError('');
    try {
      const p = typeof pageArg === 'number' ? pageArg : page;
      const json = await apiFetch(`/clients/me/transactions?type=INGRESO&page=${p}&size=${PAGE_SIZE}`);
      setData(json);
    } catch (e) {
      setError(t('dashboardClient.history.errorLoad', { defaultValue: 'No se pudo cargar el historial.' }));
    } finally {
      setBusy(false);
    }
  }, [page, t]);

  useEffect(() => { load(0); }, [load]);

  const items = data?.items || [];
  const totalPages = data?.totalPages ?? 0;
  const totalElements = data?.totalElements ?? 0;

  const goPrev = () => { if (page > 0 && !busy) { const np = page - 1; setPage(np); load(np); } };
  const goNext = () => { if (page < totalPages - 1 && !busy) { const np = page + 1; setPage(np); load(np); } };

  return (
    <div style={wrap}>
      <div style={headerRow}>
        <div>
          <h2 style={title}>{t('dashboardClient.history.title', { defaultValue: 'Historial de recargas' })}</h2>
          <div style={subtitle}>
            {t('dashboardClient.history.subtitle', { defaultValue: 'Tus cargas de saldo. Guarda este historial si tu banco te pide justificantes.' })}
          </div>
        </div>
        <button style={btn('primary', busy)} onClick={() => load(page)} disabled={busy}>
          {busy
            ? t('dashboardClient.history.loading', { defaultValue: 'Cargando...' })
            : t('dashboardClient.history.refresh', { defaultValue: 'Refrescar' })}
        </button>
      </div>

      {error && <div style={errBox}>{error}</div>}

      <table style={table}>
        <thead>
          <tr>
            <th style={th}>{t('dashboardClient.history.col.date', { defaultValue: 'Fecha' })}</th>
            <th style={th}>{t('dashboardClient.history.col.pack', { defaultValue: 'Pack' })}</th>
            <th style={{ ...th, textAlign: 'right' }}>{t('dashboardClient.history.col.amount', { defaultValue: 'Importe' })}</th>
            <th style={th}>{t('dashboardClient.history.col.reference', { defaultValue: 'Referencia' })}</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && !busy && (
            <tr><td style={empty} colSpan={4}>
              {t('dashboardClient.history.noRows', { defaultValue: 'Aun no tienes recargas registradas.' })}
            </td></tr>
          )}
          {items.map((it) => {
            const parsed = parseDescription(it.description);
            return (
              <tr key={it.id}>
                <td style={td}>{fmtDate(it.timestamp)}</td>
                <td style={td}>{parsed.pack || '-'}</td>
                <td style={tdAmount}>{fmtEUR(it.amount)}</td>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: 12, color: '#52607a' }}>
                  {parsed.orderShort || parsed.raw || '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div style={pager}>
          <div>
            {t('dashboardClient.history.pageInfo', {
              defaultValue: 'Pagina {{page}} de {{total}} · {{count}} recargas en total',
              page: page + 1,
              total: totalPages,
              count: totalElements,
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btn('secondary', busy || page === 0)} onClick={goPrev} disabled={busy || page === 0}>
              {t('dashboardClient.history.prev', { defaultValue: 'Anterior' })}
            </button>
            <button style={btn('secondary', busy || page >= totalPages - 1)} onClick={goNext} disabled={busy || page >= totalPages - 1}>
              {t('dashboardClient.history.next', { defaultValue: 'Siguiente' })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientHistoryPanel;
