// Panel "Historial" del dashboard cliente.
// Fase 1 (2026-07-19): solo INGRESO, tabla + refresh manual + paginacion.
// Fase 2 (2026-07-19): filtro por categoria (agrupa varios operation_type
// en 1 selector) + rango de fechas + columna tipo con color por signo.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload } from '@fortawesome/free-solid-svg-icons';
import i18n from '../../i18n';
import { apiFetch } from '../../config/http';
import { buildApiUrl } from '../../config/api';

const wrap = { padding: '20px 24px', maxWidth: 1000 };
const headerRow = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' };
const btn = (variant = 'primary', disabled = false) => ({
  padding: '8px 16px', borderRadius: 8, border: 'none',
  background: disabled ? '#4b5563' : variant === 'primary' ? '#2f81f7' : '#3f4a5a',
  color: '#ffffff',
  fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
});
// Estilo ghost/outline para "Descargar CSV". Se diferencia visualmente
// de los botones Limpiar/Aplicar (accion sobre datos ya cargados vs
// acciones sobre filtros) sin competir con Aplicar por atencion.
const btnGhost = (disabled = false) => ({
  padding: '7px 14px', borderRadius: 8,
  border: `1px solid ${disabled ? '#4b5563' : '#3b82f6'}`,
  background: 'transparent',
  color: disabled ? '#6b7280' : '#93c5fd',
  fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6,
});
const title = { fontSize: 20, fontWeight: 700, color: '#f8fafc', margin: 0 };
const subtitle = { fontSize: 13, color: '#9ca3af', marginTop: 4 };

// Barra de filtros sobre fondo oscuro. Card con fondo blanco para inputs
// legibles + labels claras arriba.
const filterBar = {
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 10,
  padding: 12,
  marginBottom: 12,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 12,
};
const filterLabel = { fontSize: 11, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' };
const input = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid #d0d7de', fontSize: 13, boxSizing: 'border-box', background: '#fff', color: '#18212f',
};
// Distribucion opuesta: Descargar CSV a la izquierda (accion sobre datos
// ya cargados) + [Limpiar, Aplicar] a la derecha (acciones sobre los
// filtros). Separacion espacial refleja la separacion semantica.
const filterActions = { gridColumn: '1 / -1', display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center' };
const filterActionsRight = { display: 'flex', gap: 8, flexWrap: 'wrap' };
// Wrapper con scroll horizontal solo en la tabla. Evita que el body de
// la pagina scrollee horizontalmente en moviles cuando el contenido de
// las celdas (p.ej. "Cargo por streaming de 199 segundos") excede el
// viewport. Patron estandar de fintechs (Revolut, Wise) para tablas
// con muchas columnas.
const tableWrap = { overflowX: 'auto', WebkitOverflowScrolling: 'touch' };

const table = { width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff', border: '1px solid #e1e4e8', borderRadius: 8, overflow: 'hidden' };
const th = { textAlign: 'left', padding: '10px 12px', background: '#f4f6f9', color: '#3a4152', fontWeight: 600, borderBottom: '1px solid #e1e4e8' };
const td = { padding: '10px 12px', borderBottom: '1px solid #eef1f4', color: '#18212f' };
const tdAmount = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 };
const empty = { padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 13 };
const errBox = { padding: 12, background: '#5a1a1e', borderRadius: 8, color: '#fecaca', border: '1px solid #b91c1c', marginBottom: 12, fontSize: 13 };
const pager = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12, fontSize: 13, color: '#cbd5e1' };
const pill = (bg, fg) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: bg, color: fg });

const PAGE_SIZE = 20;

// Mapeo categoria UI -> lista de operation_type reales del backend.
// null = "todos" (no filtra). Los labels se resuelven via i18n a partir
// de la key (dashboardClient.history.categories.<key en minusculas>).
const CATEGORIES = [
  { key: 'ALL',       i18nKey: 'all',       types: null },
  { key: 'RECARGAS',  i18nKey: 'recargas',  types: ['INGRESO'] },
  { key: 'BONOS',     i18nKey: 'bonos',     types: ['BONUS_GRANT', 'REFERRAL_WELCOME_GRANT'] },
  { key: 'CONSUMO',   i18nKey: 'consumo',   types: ['STREAM_CHARGE'] },
  { key: 'REGALOS',   i18nKey: 'regalos',   types: ['GIFT_SEND'] },
  { key: 'REEMBOLSOS',i18nKey: 'reembolsos',types: ['MANUAL_REFUND'] },
];

// Metadatos por operation_type para la pill de la columna "Tipo".
// Los labels (Recarga / Bono / etc.) vienen de i18n en runtime; aqui
// solo guardamos colores y signo (que no cambian por idioma).
const TYPE_STYLE = {
  INGRESO:                { pill: { bg: '#dcfce7', fg: '#166534' }, sign: '+' },
  BONUS_GRANT:            { pill: { bg: '#e0e7ff', fg: '#3730a3' }, sign: '+' },
  REFERRAL_WELCOME_GRANT: { pill: { bg: '#e0e7ff', fg: '#3730a3' }, sign: '+' },
  STREAM_CHARGE:          { pill: { bg: '#fee2e2', fg: '#991b1b' }, sign: '-' },
  GIFT_SEND:              { pill: { bg: '#fef3c7', fg: '#92400e' }, sign: '-' },
  MANUAL_REFUND:          { pill: { bg: '#dbeafe', fg: '#1e40af' }, sign: '+' },
};

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
  // El backend guarda amounts positivos o negativos segun el tipo.
  // Mostramos siempre valor absoluto + signo derivado del meta.
  return `${sign}${Math.abs(v).toFixed(2)} EUR`;
};

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

  // Filtros aplicados actualmente (con los que se hizo el ultimo fetch).
  const [appliedCategory, setAppliedCategory] = useState('ALL');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');

  // Filtros en edicion (los del formulario, aun no aplicados).
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
    return `/clients/me/transactions?${params.toString()}`;
  }, []);

  const load = useCallback(async (pageArg, category, from, to) => {
    setBusy(true);
    setError('');
    try {
      const json = await apiFetch(buildUrl(pageArg, category, from, to));
      setData(json);
    } catch (e) {
      setError(t('dashboardClient.history.errorLoad', { defaultValue: 'No se pudo cargar el historial.' }));
    } finally {
      setBusy(false);
    }
  }, [buildUrl, t]);

  // Carga inicial: sin filtros (Todos, sin fechas).
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

  // Fase 3: descarga CSV. Reutiliza los filtros APLICADOS (no draft) para
  // exportar lo que el usuario esta viendo. Simple GET con cookie de
  // sesion; el backend responde text/csv + Content-Disposition attachment
  // y el navegador dispara la descarga por si mismo. Sin blob ni fetch —
  // usar directamente window.location es el patron mas robusto para
  // descargas autenticadas cuando el response body es grande.
  const downloadCsv = () => {
    const params = new URLSearchParams();
    const cat = CATEGORIES.find(c => c.key === appliedCategory);
    if (cat && cat.types && cat.types.length > 0) {
      params.set('types', cat.types.join(','));
    }
    if (appliedFrom) params.set('from', appliedFrom);
    if (appliedTo) params.set('to', appliedTo);
    const qs = params.toString();
    const url = buildApiUrl(`/clients/me/transactions/export${qs ? '?' + qs : ''}`);
    window.location.href = url;
  };

  const items = data?.items || [];
  const totalPages = data?.totalPages ?? 0;
  const totalElements = data?.totalElements ?? 0;

  const goPrev = () => {
    if (page > 0 && !busy) {
      const np = page - 1;
      setPage(np);
      load(np, appliedCategory, appliedFrom, appliedTo);
    }
  };
  const goNext = () => {
    if (page < totalPages - 1 && !busy) {
      const np = page + 1;
      setPage(np);
      load(np, appliedCategory, appliedFrom, appliedTo);
    }
  };

  const activeFilterLabel = useMemo(() => {
    const cat = CATEGORIES.find(c => c.key === appliedCategory);
    const catLabel = cat
      ? t(`dashboardClient.history.categories.${cat.i18nKey}`)
      : t('dashboardClient.history.categories.all');
    const parts = [catLabel];
    if (appliedFrom) parts.push(t('dashboardClient.history.activeFilter.from', { defaultValue: 'desde {{d}}', d: appliedFrom }));
    if (appliedTo) parts.push(t('dashboardClient.history.activeFilter.to', { defaultValue: 'hasta {{d}}', d: appliedTo }));
    return parts.join(' · ');
  }, [appliedCategory, appliedFrom, appliedTo, t]);

  return (
    <div style={wrap}>
      <div style={headerRow}>
        <div>
          <h2 style={title}>{t('dashboardClient.history.title', { defaultValue: 'Historial de transacciones' })}</h2>
          <div style={subtitle}>
            {t('dashboardClient.history.subtitle', { defaultValue: 'Recargas, consumo, bonos y regalos. Guarda este historial si tu banco te pide justificantes.' })}
          </div>
        </div>
        <button style={btn('primary', busy)} onClick={() => load(page, appliedCategory, appliedFrom, appliedTo)} disabled={busy}>
          {busy
            ? t('dashboardClient.history.loading', { defaultValue: 'Cargando...' })
            : t('dashboardClient.history.refresh', { defaultValue: 'Refrescar' })}
        </button>
      </div>

      <div style={filterBar}>
        <div>
          <label style={filterLabel}>{t('dashboardClient.history.filter.category', { defaultValue: 'Categoria' })}</label>
          <select style={input} value={draftCategory} onChange={(e) => setDraftCategory(e.target.value)} disabled={busy}>
            {CATEGORIES.map(c => (
              <option key={c.key} value={c.key}>{t(`dashboardClient.history.categories.${c.i18nKey}`)}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={filterLabel}>{t('dashboardClient.history.filter.from', { defaultValue: 'Desde' })}</label>
          <input type="date" style={input} value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} disabled={busy} />
        </div>
        <div>
          <label style={filterLabel}>{t('dashboardClient.history.filter.to', { defaultValue: 'Hasta' })}</label>
          <input type="date" style={input} value={draftTo} onChange={(e) => setDraftTo(e.target.value)} disabled={busy} />
        </div>
        <div style={filterActions}>
          <button style={btnGhost(busy)} onClick={downloadCsv} disabled={busy}>
            <FontAwesomeIcon icon={faDownload} />
            <span>{t('dashboardClient.history.filter.download', { defaultValue: 'Descargar CSV' })}</span>
          </button>
          <div style={filterActionsRight}>
            <button style={btn('secondary', busy)} onClick={resetFilters} disabled={busy}>
              {t('dashboardClient.history.filter.reset', { defaultValue: 'Limpiar' })}
            </button>
            <button style={btn('primary', busy)} onClick={applyFilters} disabled={busy}>
              {t('dashboardClient.history.filter.apply', { defaultValue: 'Aplicar' })}
            </button>
          </div>
        </div>
      </div>

      {error && <div style={errBox}>{error}</div>}

      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
        {t('dashboardClient.history.activeFilter.label', { defaultValue: 'Filtro' })}: <span style={{ color: '#f8fafc', fontWeight: 600 }}>{activeFilterLabel}</span>
      </div>

      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>{t('dashboardClient.history.col.date', { defaultValue: 'Fecha' })}</th>
              <th style={th}>{t('dashboardClient.history.col.type', { defaultValue: 'Tipo' })}</th>
              <th style={th}>{t('dashboardClient.history.col.detail', { defaultValue: 'Detalle' })}</th>
              <th style={{ ...th, textAlign: 'right' }}>{t('dashboardClient.history.col.amount', { defaultValue: 'Importe' })}</th>
              <th style={th}>{t('dashboardClient.history.col.reference', { defaultValue: 'Referencia' })}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !busy && (
              <tr><td style={empty} colSpan={5}>
                {t('dashboardClient.history.noRows', { defaultValue: 'No hay transacciones para los filtros aplicados.' })}
              </td></tr>
            )}
            {items.map((it) => {
              const style = TYPE_STYLE[it.operationType] || { pill: { bg: '#e5e7eb', fg: '#374151' }, sign: '' };
              const typeLabel = t(`dashboardClient.history.typeLabel.${it.operationType}`, { defaultValue: it.operationType });
              const parsed = parseDescription(it.description);
              const amountColor = style.sign === '+' ? '#166534' : style.sign === '-' ? '#991b1b' : '#18212f';
              const detailText = parsed.pack
                ? t('dashboardClient.history.detail.pack', { defaultValue: 'Pack {{pack}}', pack: parsed.pack })
                : (parsed.raw || '-');
              return (
                <tr key={it.id}>
                  <td style={td}>{fmtDate(it.timestamp)}</td>
                  <td style={td}><span style={pill(style.pill.bg, style.pill.fg)}>{typeLabel}</span></td>
                  <td style={td}>{detailText}</td>
                  <td style={{ ...tdAmount, color: amountColor }}>{fmtEUR(it.amount, style.sign)}</td>
                  <td style={{ ...td, fontFamily: 'monospace', fontSize: 12, color: '#52607a' }}>
                    {parsed.orderShort || '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={pager}>
          <div>
            {t('dashboardClient.history.pageInfo', {
              defaultValue: 'Pagina {{page}} de {{total}} · {{count}} transacciones',
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
