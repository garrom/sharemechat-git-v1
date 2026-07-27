// ADR-054 T5.2: listado maestro admin de tickets. Filtros por categoria
// y estado + paginacion. Click en fila abre drill-down via callback
// onOpenDetail(id). Reload manual.

import React, { useCallback, useEffect, useState } from 'react';
import i18n from '../../../i18n';
import { listTickets } from '../../../api/adminTicketsApi';

const CATEGORIES = ['', 'STREAM_INTERRUPTED', 'PAYMENT_NOT_CREDITED', 'MODERATION_FALSE_POSITIVE', 'ACCOUNT_ISSUE', 'OTHER'];
const STATUSES = ['', 'OPEN', 'INVESTIGATING', 'RESOLVED_COMPENSATED_PENDING_CREDIT', 'RESOLVED_COMPENSATED', 'RESOLVED_NO_COMPENSATION', 'REJECTED_INVALID', 'ABANDONED'];

const wrap = { padding: '16px 20px' };
const headerRow = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' };
const title = { fontSize: 18, fontWeight: 700, color: '#f8fafc', margin: 0 };
const sub = { fontSize: 12, color: '#9ca3af', marginTop: 4 };
const filterBar = {
  background: '#1e293b', border: '1px solid #334155', borderRadius: 10,
  padding: 10, marginBottom: 12, display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10,
};
const filterLabel = { fontSize: 10, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' };
const inputStyle = { width: '100%', padding: '6px 8px', border: '1px solid #d0d7de', borderRadius: 6, background: '#fff', color: '#18212f', fontSize: 13, boxSizing: 'border-box' };
const table = { width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff', border: '1px solid #e1e4e8', borderRadius: 8, overflow: 'hidden' };
const th = { textAlign: 'left', padding: '9px 10px', background: '#f4f6f9', color: '#3a4152', fontWeight: 600, borderBottom: '1px solid #e1e4e8' };
const td = { padding: '9px 10px', borderBottom: '1px solid #eef1f4', color: '#18212f' };
const trStyle = { cursor: 'pointer' };
const errBox = { padding: 10, background: '#5a1a1e', borderRadius: 8, color: '#fecaca', border: '1px solid #b91c1c', marginBottom: 12, fontSize: 13 };
const empty = { padding: 16, textAlign: 'center', color: '#6b7280', fontSize: 13 };
const btn = (variant = 'secondary', disabled = false) => ({
  padding: '7px 14px', borderRadius: 6, border: 'none',
  background: disabled ? '#4b5563' : variant === 'primary' ? '#2563eb' : '#3f4a5a',
  color: '#ffffff', fontSize: 13, fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
});
const pager = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10, fontSize: 12, color: '#cbd5e1' };

const statusPillStyle = (status) => {
  const map = {
    OPEN:                                { bg: '#dbeafe', fg: '#1e40af' },
    INVESTIGATING:                       { bg: '#fef3c7', fg: '#92400e' },
    RESOLVED_COMPENSATED_PENDING_CREDIT: { bg: '#fde68a', fg: '#78350f' },
    RESOLVED_COMPENSATED:                { bg: '#bbf7d0', fg: '#14532d' },
    RESOLVED_NO_COMPENSATION:            { bg: '#e5e7eb', fg: '#374151' },
    REJECTED_INVALID:                    { bg: '#fecaca', fg: '#7f1d1d' },
    ABANDONED:                           { bg: '#e5e7eb', fg: '#6b7280' },
  };
  const c = map[status] || { bg: '#e5e7eb', fg: '#374151' };
  return {
    display: 'inline-block', padding: '2px 8px', borderRadius: 999,
    fontSize: 11, fontWeight: 600, background: c.bg, color: c.fg,
  };
};
const signalPillStyle = (signal) => {
  const map = {
    STRONG_POSITIVE: { bg: '#bbf7d0', fg: '#14532d' },
    WEAK_POSITIVE:   { bg: '#fef9c3', fg: '#713f12' },
    NEUTRAL:         { bg: '#e5e7eb', fg: '#374151' },
    NEGATIVE:        { bg: '#fecaca', fg: '#7f1d1d' },
  };
  const c = map[signal] || { bg: '#e5e7eb', fg: '#374151' };
  return {
    display: 'inline-block', padding: '1px 6px', borderRadius: 999,
    fontSize: 10, fontWeight: 700, background: c.bg, color: c.fg,
  };
};
const flagPill = {
  display: 'inline-block', padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700,
  background: '#f59e0b', color: '#000', marginLeft: 6,
};

function formatDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function AdminTicketsView({ onOpenDetail }) {
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [size] = useState(20);
  const [data, setData] = useState({ content: [], totalElements: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await listTickets({ category, status, page, size });
      setData(res || { content: [], totalElements: 0, totalPages: 0 });
    } catch (ex) {
      setErr((ex && ex.message) || i18n.t('admin.support.tickets.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [category, status, page, size]);

  useEffect(() => { load(); }, [load]);

  const handleFilterChange = (setter) => (e) => {
    setter(e.target.value);
    setPage(0);
  };

  const items = Array.isArray(data.content) ? data.content : [];

  return (
    <div style={wrap}>
      <div style={headerRow}>
        <div>
          <h2 style={title}>{i18n.t('admin.support.tickets.title')}</h2>
          <div style={sub}>{i18n.t('admin.support.tickets.subtitle')}</div>
        </div>
        <button type="button" style={btn('secondary', loading)} onClick={load} disabled={loading}>
          {loading ? i18n.t('admin.support.tickets.loading') : i18n.t('admin.support.tickets.refresh')}
        </button>
      </div>

      <div style={filterBar}>
        <div>
          <label style={filterLabel}>{i18n.t('admin.support.tickets.filters.category')}</label>
          <select style={inputStyle} value={category} onChange={handleFilterChange(setCategory)}>
            {CATEGORIES.map(c => (
              <option key={c || 'all'} value={c}>
                {c ? i18n.t(`admin.support.tickets.categories.${c}`) : i18n.t('admin.support.tickets.filters.all')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={filterLabel}>{i18n.t('admin.support.tickets.filters.status')}</label>
          <select style={inputStyle} value={status} onChange={handleFilterChange(setStatus)}>
            {STATUSES.map(s => (
              <option key={s || 'all'} value={s}>
                {s ? i18n.t(`admin.support.tickets.statuses.${s}`) : i18n.t('admin.support.tickets.filters.all')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {err && <div style={errBox}>{err}</div>}

      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>{i18n.t('admin.support.tickets.listHeaders.id')}</th>
              <th style={th}>{i18n.t('admin.support.tickets.listHeaders.user')}</th>
              <th style={th}>{i18n.t('admin.support.tickets.listHeaders.category')}</th>
              <th style={th}>{i18n.t('admin.support.tickets.listHeaders.status')}</th>
              <th style={th}>{i18n.t('admin.support.tickets.listHeaders.signal')}</th>
              <th style={th}>{i18n.t('admin.support.tickets.listHeaders.createdAt')}</th>
              <th style={th}>{i18n.t('admin.support.tickets.listHeaders.compensated')}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading && (
              <tr><td colSpan={7} style={empty}>{i18n.t('admin.support.tickets.empty')}</td></tr>
            )}
            {items.map(t => (
              <tr key={t.id} style={trStyle} onClick={() => onOpenDetail && onOpenDetail(t.id)}>
                <td style={td}>#{t.id}</td>
                <td style={td}>#{t.userId}</td>
                <td style={td}>{i18n.t(`admin.support.tickets.categories.${t.category}`, { defaultValue: t.category })}</td>
                <td style={td}>
                  <span style={statusPillStyle(t.status)}>
                    {i18n.t(`admin.support.tickets.statuses.${t.status}`, { defaultValue: t.status })}
                  </span>
                  {t.highHistoryFlag && <span style={flagPill} title="high history">FLAG</span>}
                </td>
                <td style={td}>
                  {t.verificationLastSignal
                    ? <span style={signalPillStyle(t.verificationLastSignal)}>
                        {i18n.t(`admin.support.tickets.signals.${t.verificationLastSignal}`, { defaultValue: t.verificationLastSignal })}
                      </span>
                    : '—'}
                </td>
                <td style={td}>{formatDate(t.createdAt)}</td>
                <td style={td}>{t.compensatedAmountEur ? `${t.compensatedAmountEur} €` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={pager}>
        <div>Page {data.page + 1 || 1} of {data.totalPages || 1} · {data.totalElements || 0} total</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" style={btn('secondary', page === 0 || loading)} onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0 || loading}>&larr;</button>
          <button type="button" style={btn('secondary', page + 1 >= (data.totalPages || 1) || loading)} onClick={() => setPage(p => p + 1)} disabled={page + 1 >= (data.totalPages || 1) || loading}>&rarr;</button>
        </div>
      </div>
    </div>
  );
}
