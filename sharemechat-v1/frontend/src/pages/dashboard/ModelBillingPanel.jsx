// Panel "Facturacion" del modelo (2026-07-19 Fase 2 Estadistica).
// Se monta DENTRO de la tab 'billing' del componente Estadistica —
// reutiliza los styled-components de EstadisticaStyles para heredar
// el tema claro con acentos pastel.
//
// Consume:
//   GET /api/models/me/transactions?types=&from=&to=&page=&size=
//   GET /api/models/me/transactions/export?types=&from=&to=
//
// Operation types del modelo:
//   STREAM_EARNING (+) ganancia streaming
//   GIFT_EARNING   (+) ganancia regalo (los amount=0 filtrados backend)
//   PAYOUT_REQUEST (-) retirada solicitada
//   PAYOUT_REQUEST_REVERT (+) reversion retirada (admin cancela)

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload } from '@fortawesome/free-solid-svg-icons';
import i18n from '../../i18n';
import { apiFetch } from '../../config/http';
import { buildApiUrl } from '../../config/api';
import {
  Section,
  SectionHead,
  SectionTitle,
  SectionHint,
  TableWrap,
  Table,
} from '../../styles/pages-styles/EstadisticaStyles';

const PAGE_SIZE = 20;

// Categorias UI → lista de operation_type.
const CATEGORIES = [
  { key: 'ALL',        i18nKey: 'all',        types: null },
  { key: 'STREAMING',  i18nKey: 'streaming',  types: ['STREAM_EARNING'] },
  { key: 'REGALOS',    i18nKey: 'regalos',    types: ['GIFT_EARNING'] },
  { key: 'RETIRADAS',  i18nKey: 'retiradas',  types: ['PAYOUT_REQUEST', 'PAYOUT_REQUEST_REVERT'] },
];

const TYPE_STYLE = {
  STREAM_EARNING:         { pill: { bg: '#dcfce7', fg: '#166534' }, sign: '+' },
  GIFT_EARNING:           { pill: { bg: '#fef3c7', fg: '#92400e' }, sign: '+' },
  PAYOUT_REQUEST:         { pill: { bg: '#fee2e2', fg: '#991b1b' }, sign: '-' },
  PAYOUT_REQUEST_REVERT:  { pill: { bg: '#e0e7ff', fg: '#3730a3' }, sign: '+' },
};

// -------- Estilos inline locales (barra de filtros + botones) --------
// Se pintan aqui en vez de anadirlos a EstadisticaStyles porque son
// especificos de este panel (para no contaminar el vocabulario visual
// compartido con Estadistica y Afiliada).
const filterBar = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: 12,
  marginBottom: 12,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 12,
  boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
};
const filterLabelStyle = { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block', fontWeight: 600 };
const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box',
  background: '#ffffff', color: '#0f172a',
};
const filterActions = { gridColumn: '1 / -1', display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center' };
const filterActionsRight = { display: 'flex', gap: 8, flexWrap: 'wrap' };
const btn = (variant = 'primary', disabled = false) => ({
  padding: '8px 16px', borderRadius: 8, border: 'none',
  background: disabled ? '#cbd5e1' : variant === 'primary' ? '#2563eb' : '#e2e8f0',
  color: variant === 'primary' ? '#ffffff' : '#0f172a',
  fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
});
const btnGhost = (disabled = false) => ({
  padding: '7px 14px', borderRadius: 8,
  border: `1px solid ${disabled ? '#cbd5e1' : '#2563eb'}`,
  background: 'transparent',
  color: disabled ? '#64748b' : '#2563eb',
  fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6,
});
const errBox = { padding: 12, background: '#fee2e2', borderRadius: 8, color: '#991b1b', border: '1px solid #fca5a5', marginBottom: 12, fontSize: 13 };
const activeFilterLine = { fontSize: 12, color: '#64748b', marginBottom: 8 };
const activeFilterValue = { color: '#0f172a', fontWeight: 600 };
const pager = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12, fontSize: 13, color: '#64748b' };
const pill = (bg, fg) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: bg, color: fg });
const emptyRow = { padding: 20, textAlign: 'center', color: '#64748b', fontSize: 13 };
const amountCell = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 };
const refCell = { fontFamily: 'monospace', fontSize: 12, color: '#64748b' };

const fmtDate = (iso) => {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toISOString().slice(0, 16).replace('T', ' ');
  } catch { return String(iso); }
};

const fmtEUR = (n, sign = '+') => {
  const v = Number(n);
  if (!isFinite(v)) return '-';
  return `${sign}${Math.abs(v).toFixed(2)} EUR`;
};

// Extrae metadatos de description tipo "Ganancia por streaming de 199 segundos"
// o "Payout request bank_transfer".
const parseDescription = (desc) => {
  if (!desc) return { detail: null };
  const secMatch = desc.match(/(\d+)\s*segundos?/i);
  if (secMatch) {
    const s = Number(secMatch[1]);
    return { detail: `${s}s (${Math.floor(s / 60)}m ${s % 60}s)` };
  }
  return { detail: desc.length > 60 ? desc.slice(0, 57) + '…' : desc };
};

export default function ModelBillingPanel() {
  const t = useCallback((key, options) => i18n.t(key, options), []);

  const [appliedCategory, setAppliedCategory] = useState('ALL');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');

  const [draftCategory, setDraftCategory] = useState('ALL');
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');

  const [data, setData] = useState(null);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const buildUrl = useCallback((pageArg, category, from, to) => {
    const params = new URLSearchParams();
    const cat = CATEGORIES.find(c => c.key === category);
    if (cat && cat.types && cat.types.length > 0) {
      params.set('types', cat.types.join(','));
    }
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    params.set('page', String(pageArg));
    params.set('size', String(PAGE_SIZE));
    return `/models/me/transactions?${params.toString()}`;
  }, []);

  const load = useCallback(async (pageArg, category, from, to) => {
    setBusy(true);
    setError('');
    try {
      const json = await apiFetch(buildUrl(pageArg, category, from, to));
      setData(json);
    } catch (e) {
      setError(t('dashboardModel.billing.errorLoad', { defaultValue: 'No se pudo cargar la facturacion.' }));
    } finally {
      setBusy(false);
    }
  }, [buildUrl, t]);

  useEffect(() => { load(0, 'ALL', '', ''); }, [load]);

  const applyFilters = () => {
    setAppliedCategory(draftCategory);
    setAppliedFrom(draftFrom);
    setAppliedTo(draftTo);
    setPage(0);
    load(0, draftCategory, draftFrom, draftTo);
  };

  const resetFilters = () => {
    setDraftCategory('ALL');
    setDraftFrom('');
    setDraftTo('');
    setAppliedCategory('ALL');
    setAppliedFrom('');
    setAppliedTo('');
    setPage(0);
    load(0, 'ALL', '', '');
  };

  const downloadCsv = () => {
    const params = new URLSearchParams();
    const cat = CATEGORIES.find(c => c.key === appliedCategory);
    if (cat && cat.types && cat.types.length > 0) params.set('types', cat.types.join(','));
    if (appliedFrom) params.set('from', appliedFrom);
    if (appliedTo) params.set('to', appliedTo);
    const qs = params.toString();
    const url = buildApiUrl(`/models/me/transactions/export${qs ? '?' + qs : ''}`);
    window.location.href = url;
  };

  const items = data?.items || [];
  const totalPages = data?.totalPages ?? 0;
  const totalElements = data?.totalElements ?? 0;

  const goPrev = () => {
    if (page > 0 && !busy) { const np = page - 1; setPage(np); load(np, appliedCategory, appliedFrom, appliedTo); }
  };
  const goNext = () => {
    if (page < totalPages - 1 && !busy) { const np = page + 1; setPage(np); load(np, appliedCategory, appliedFrom, appliedTo); }
  };

  const activeFilterLabel = useMemo(() => {
    const cat = CATEGORIES.find(c => c.key === appliedCategory);
    const catLabel = cat
      ? t(`dashboardModel.billing.categories.${cat.i18nKey}`, { defaultValue: cat.key })
      : t('dashboardModel.billing.categories.all', { defaultValue: 'Todos' });
    const parts = [catLabel];
    if (appliedFrom) parts.push(t('dashboardModel.billing.activeFilter.from', { defaultValue: 'desde {{d}}', d: appliedFrom }));
    if (appliedTo) parts.push(t('dashboardModel.billing.activeFilter.to', { defaultValue: 'hasta {{d}}', d: appliedTo }));
    return parts.join(' · ');
  }, [appliedCategory, appliedFrom, appliedTo, t]);

  return (
    <Section>
      <SectionHead>
        <SectionTitle>{t('dashboardModel.billing.title', { defaultValue: 'Facturacion' })}</SectionTitle>
        <SectionHint>
          {t('dashboardModel.billing.subtitle', { defaultValue: 'Streaming, regalos y retiradas. Guarda este historial si necesitas justificantes.' })}
        </SectionHint>
      </SectionHead>

      <div style={filterBar}>
        <div>
          <label style={filterLabelStyle}>{t('dashboardModel.billing.filter.category', { defaultValue: 'Categoria' })}</label>
          <select style={inputStyle} value={draftCategory} onChange={(e) => setDraftCategory(e.target.value)} disabled={busy}>
            {CATEGORIES.map(c => (
              <option key={c.key} value={c.key}>
                {t(`dashboardModel.billing.categories.${c.i18nKey}`, { defaultValue: c.key })}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={filterLabelStyle}>{t('dashboardModel.billing.filter.from', { defaultValue: 'Desde' })}</label>
          <input type="date" style={inputStyle} value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} disabled={busy} />
        </div>
        <div>
          <label style={filterLabelStyle}>{t('dashboardModel.billing.filter.to', { defaultValue: 'Hasta' })}</label>
          <input type="date" style={inputStyle} value={draftTo} onChange={(e) => setDraftTo(e.target.value)} disabled={busy} />
        </div>
        <div style={filterActions}>
          <button style={btnGhost(busy)} onClick={downloadCsv} disabled={busy}>
            <FontAwesomeIcon icon={faDownload} />
            <span>{t('dashboardModel.billing.filter.download', { defaultValue: 'Descargar CSV' })}</span>
          </button>
          <div style={filterActionsRight}>
            <button style={btn('secondary', busy)} onClick={resetFilters} disabled={busy}>
              {t('dashboardModel.billing.filter.reset', { defaultValue: 'Limpiar' })}
            </button>
            <button style={btn('primary', busy)} onClick={applyFilters} disabled={busy}>
              {t('dashboardModel.billing.filter.apply', { defaultValue: 'Aplicar' })}
            </button>
          </div>
        </div>
      </div>

      {error && <div style={errBox}>{error}</div>}

      <div style={activeFilterLine}>
        {t('dashboardModel.billing.activeFilter.label', { defaultValue: 'Filtro' })}: <span style={activeFilterValue}>{activeFilterLabel}</span>
      </div>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <th>{t('dashboardModel.billing.col.date', { defaultValue: 'Fecha' })}</th>
              <th>{t('dashboardModel.billing.col.type', { defaultValue: 'Tipo' })}</th>
              <th>{t('dashboardModel.billing.col.detail', { defaultValue: 'Detalle' })}</th>
              <th style={{ textAlign: 'right' }}>{t('dashboardModel.billing.col.amount', { defaultValue: 'Importe' })}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !busy && (
              <tr><td style={emptyRow} colSpan={4}>
                {t('dashboardModel.billing.noRows', { defaultValue: 'No hay operaciones para los filtros aplicados.' })}
              </td></tr>
            )}
            {items.map((it) => {
              const style = TYPE_STYLE[it.operationType] || { pill: { bg: '#e5e7eb', fg: '#374151' }, sign: '' };
              const typeLabel = t(`dashboardModel.billing.typeLabel.${it.operationType}`, { defaultValue: it.operationType });
              const parsed = parseDescription(it.description);
              const amountColor = style.sign === '+' ? '#166534' : style.sign === '-' ? '#991b1b' : '#0f172a';
              return (
                <tr key={it.id}>
                  <td>{fmtDate(it.timestamp)}</td>
                  <td><span style={pill(style.pill.bg, style.pill.fg)}>{typeLabel}</span></td>
                  <td style={refCell}>{parsed.detail || '-'}</td>
                  <td style={{ ...amountCell, color: amountColor }}>{fmtEUR(it.amount, style.sign)}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </TableWrap>

      {totalPages > 1 && (
        <div style={pager}>
          <div>
            {t('dashboardModel.billing.pageInfo', {
              defaultValue: 'Pagina {{page}} de {{total}} · {{count}} operaciones',
              page: page + 1,
              total: totalPages,
              count: totalElements,
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btn('secondary', busy || page === 0)} onClick={goPrev} disabled={busy || page === 0}>
              {t('dashboardModel.billing.prev', { defaultValue: 'Anterior' })}
            </button>
            <button style={btn('secondary', busy || page >= totalPages - 1)} onClick={goNext} disabled={busy || page >= totalPages - 1}>
              {t('dashboardModel.billing.next', { defaultValue: 'Siguiente' })}
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}
