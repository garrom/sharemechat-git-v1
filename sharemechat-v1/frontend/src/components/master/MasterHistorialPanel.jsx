// MasterHistorialPanel.jsx — ADR-056 Fase S5.a.8.a.
// Ledger paginado del Master con filtros de rango + tipo operacion.
// Consume masterApi.listTransactions (backend S5.a.3).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import i18n from '../../i18n';
import masterApi from '../../api/masterApi';

// ============================================================
// Estilos (patron MasterModelosPanel)
// ============================================================
const Card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px' };
const Header = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 };
const H2 = { margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#111827' };

const ControlsRow = { display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 };
const FieldBlock = { display: 'flex', flexDirection: 'column', gap: 4 };
const Label = { fontSize: '0.78rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' };
const Select = {
  padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db',
  fontSize: '0.9rem', color: '#111827', background: '#fff', minWidth: 140,
};
const DateInput = {
  padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db',
  fontSize: '0.9rem', color: '#111827', background: '#fff',
};
const BtnRefresh = {
  padding: '7px 14px', borderRadius: 6, border: '1px solid #7c3aed',
  background: '#fff', color: '#7c3aed', cursor: 'pointer',
  fontSize: '0.85rem', fontWeight: 600,
};

const TableWrap = { overflowX: 'auto' };
const Table = { width: '100%', borderCollapse: 'collapse', minWidth: 640 };
const Th = { textAlign: 'left', padding: '10px 12px', fontWeight: 600, color: '#374151', background: '#f3f4f6', fontSize: '0.82rem', borderBottom: '1px solid #e5e7eb', textTransform: 'uppercase', letterSpacing: '0.03em' };
const Td = { padding: '10px 12px', color: '#111827', fontSize: '0.92rem', borderBottom: '1px solid #f3f4f6' };
const Empty = { padding: '32px 20px', textAlign: 'center', color: '#6b7280', fontSize: '0.95rem' };
const ErrorBox = { padding: '12px 16px', background: '#fee2e2', color: '#991b1b', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' };

const Pagination = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginTop: 12, gap: 12, flexWrap: 'wrap',
};
const PageInfo = { fontSize: '0.85rem', color: '#6b7280' };
const PageBtns = { display: 'flex', gap: 6 };
const PageBtn = (disabled) => ({
  padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db',
  background: disabled ? '#f3f4f6' : '#fff', color: disabled ? '#9ca3af' : '#374151',
  cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '0.85rem',
});

// ============================================================
// Helpers
// ============================================================
const t = (k, opts) => i18n.t(k, opts);

const fmtEur = (n) => {
  if (n == null) return '—';
  try {
    return new Intl.NumberFormat(i18n.language || 'es', {
      style: 'currency', currency: 'EUR', maximumFractionDigits: 2,
    }).format(Number(n));
  } catch { return `${Number(n).toFixed(2)} €`; }
};
const fmtDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
};

const isoDay = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Preset rangos: devuelve {from, to} en yyyy-MM-dd o {} para "todo".
// Uso Date + Date.now() indirecto via `new Date()` (permitido en app run-time,
// no en workflows). Recalcula al aplicar el preset — no cachea.
const rangeFromPreset = (preset) => {
  if (preset === 'ALL' || preset === 'CUSTOM') return {};
  const to = new Date();
  const from = new Date();
  if (preset === '7D') from.setDate(from.getDate() - 7);
  else if (preset === '30D') from.setDate(from.getDate() - 30);
  else if (preset === '90D') from.setDate(from.getDate() - 90);
  return { from: isoDay(from), to: isoDay(to) };
};

// Mapeo dropdown tipo -> types param backend.
// El backend ya soporta CSV en `types=` (mayusculas).
// INGRESOS incluye STREAM_EARNING y GIFT_EARNING atribuidos al Master
// (ADR-056 revision 2026-08-01: los gifts de modelos bajo Master
// pasan por el Master igual que streams).
const typesFromDropdown = (tipo) => {
  if (tipo === 'ALL') return null;
  if (tipo === 'INGRESOS') return ['STREAM_EARNING', 'GIFT_EARNING'];
  if (tipo === 'GIFTS') return ['GIFT_EARNING'];
  if (tipo === 'RETIROS') return ['PAYOUT_REQUEST'];
  return null;
};

// ============================================================
// Componente
// ============================================================
export default function MasterHistorialPanel() {
  const [preset, setPreset] = useState('30D');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [tipo, setTipo] = useState('ALL');
  const [pageSize, setPageSize] = useState(20);

  const [page, setPage] = useState(0);
  const [data, setData] = useState({ items: [], page: 0, size: 20, totalPages: 0, totalElements: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const effectiveRange = useMemo(() => {
    if (preset === 'CUSTOM') return { from: customFrom || undefined, to: customTo || undefined };
    return rangeFromPreset(preset);
  }, [preset, customFrom, customTo]);

  const load = useCallback(async (targetPage) => {
    setLoading(true);
    setError('');
    try {
      const opts = {
        page: targetPage,
        size: pageSize,
      };
      const types = typesFromDropdown(tipo);
      if (types) opts.types = types;
      if (effectiveRange.from) opts.from = effectiveRange.from;
      if (effectiveRange.to) opts.to = effectiveRange.to;
      const res = await masterApi.listTransactions(opts);
      setData({
        items: Array.isArray(res?.items) ? res.items : [],
        page: res?.page ?? 0,
        size: res?.size ?? pageSize,
        totalPages: res?.totalPages ?? 0,
        totalElements: res?.totalElements ?? 0,
      });
    } catch (err) {
      setError(err?.data?.error || err?.message || t('masterDashboard.historial.errors.load'));
    } finally {
      setLoading(false);
    }
  }, [pageSize, tipo, effectiveRange.from, effectiveRange.to]);

  // Al cambiar filtros, resetear a page 0.
  useEffect(() => { setPage(0); }, [preset, customFrom, customTo, tipo, pageSize]);

  useEffect(() => { load(page); }, [load, page]);

  const isIncome = (op) => op === 'STREAM_EARNING' || op === 'GIFT_EARNING';
  const opLabel = (op) => {
    if (op === 'STREAM_EARNING') return t('masterDashboard.historial.opTypes.streamEarning');
    if (op === 'GIFT_EARNING') return t('masterDashboard.historial.opTypes.giftEarning');
    if (op === 'PAYOUT_REQUEST') return t('masterDashboard.historial.opTypes.payoutRequest');
    return op;
  };

  return (
    <div style={Card}>
      <div style={Header}>
        <div>
          <h2 style={H2}>{t('masterDashboard.historial.title')}</h2>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: 4 }}>
            {t('masterDashboard.historial.subtitle')}
          </div>
        </div>
      </div>

      <div style={ControlsRow}>
        <div style={FieldBlock}>
          <span style={Label}>{t('masterDashboard.historial.filters.range')}</span>
          <select style={Select} value={preset} onChange={(e) => setPreset(e.target.value)}>
            <option value="7D">{t('masterDashboard.historial.presets.d7')}</option>
            <option value="30D">{t('masterDashboard.historial.presets.d30')}</option>
            <option value="90D">{t('masterDashboard.historial.presets.d90')}</option>
            <option value="ALL">{t('masterDashboard.historial.presets.all')}</option>
            <option value="CUSTOM">{t('masterDashboard.historial.presets.custom')}</option>
          </select>
        </div>

        {preset === 'CUSTOM' && (
          <>
            <div style={FieldBlock}>
              <span style={Label}>{t('masterDashboard.historial.filters.from')}</span>
              <input
                style={DateInput}
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </div>
            <div style={FieldBlock}>
              <span style={Label}>{t('masterDashboard.historial.filters.to')}</span>
              <input
                style={DateInput}
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          </>
        )}

        <div style={FieldBlock}>
          <span style={Label}>{t('masterDashboard.historial.filters.type')}</span>
          <select style={Select} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="ALL">{t('masterDashboard.historial.tipos.all')}</option>
            <option value="INGRESOS">{t('masterDashboard.historial.tipos.income')}</option>
            <option value="GIFTS">{t('masterDashboard.historial.tipos.gifts')}</option>
            <option value="RETIROS">{t('masterDashboard.historial.tipos.payout')}</option>
          </select>
        </div>

        <div style={FieldBlock}>
          <span style={Label}>{t('masterDashboard.historial.filters.pageSize')}</span>
          <select style={Select} value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>

        <button type="button" style={BtnRefresh} onClick={() => load(page)} disabled={loading}>
          {loading ? t('common.loading') : t('masterDashboard.historial.actions.refresh')}
        </button>
      </div>

      {error && <div style={ErrorBox} role="alert">{error}</div>}

      {loading && <div style={Empty}>{t('common.loading')}</div>}

      {!loading && data.items.length === 0 && (
        <div style={Empty}>
          <p style={{ margin: 0 }}>{t('masterDashboard.historial.empty.title')}</p>
          <p style={{ margin: '8px 0 0', fontSize: '0.85rem' }}>{t('masterDashboard.historial.empty.hint')}</p>
        </div>
      )}

      {!loading && data.items.length > 0 && (
        <>
          <div style={TableWrap}>
            <table style={Table}>
              <thead>
                <tr>
                  <th style={Th}>{t('masterDashboard.historial.cols.date')}</th>
                  <th style={Th}>{t('masterDashboard.historial.cols.type')}</th>
                  <th style={Th}>{t('masterDashboard.historial.cols.amount')}</th>
                  <th style={Th}>{t('masterDashboard.historial.cols.description')}</th>
                  <th style={Th}>{t('masterDashboard.historial.cols.attributedModel')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id}>
                    <td style={Td}>{fmtDate(row.timestamp)}</td>
                    <td style={Td}>{opLabel(row.operationType)}</td>
                    <td style={{ ...Td, color: isIncome(row.operationType) ? '#059669' : '#dc2626', fontWeight: 600 }}>
                      {fmtEur(row.amount)}
                    </td>
                    <td style={Td}>{row.description || '—'}</td>
                    <td style={Td}>
                      {row.attributedModelUserId
                        ? (row.attributedModelNickname
                            ? `${row.attributedModelNickname} (#${row.attributedModelUserId})`
                            : `#${row.attributedModelUserId}`)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={Pagination}>
            <div style={PageInfo}>
              {t('masterDashboard.historial.pagination.info', {
                page: data.page + 1,
                totalPages: Math.max(1, data.totalPages),
                total: data.totalElements,
              })}
            </div>
            <div style={PageBtns}>
              <button
                type="button"
                style={PageBtn(page <= 0)}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page <= 0}
              >
                {t('masterDashboard.historial.pagination.prev')}
              </button>
              <button
                type="button"
                style={PageBtn(page >= data.totalPages - 1)}
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= data.totalPages - 1}
              >
                {t('masterDashboard.historial.pagination.next')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
