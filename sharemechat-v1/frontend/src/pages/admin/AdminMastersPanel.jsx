// AdminMastersPanel.jsx — ADR-056 Fase S7.a (2026-08-02).
// Lectura del panel admin de Masters (estudios). Listado paginado +
// filtros básicos + drill-down con detalle + modelos bajo su cuenta.
// Suspensión D11 pendiente para S7.b.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import i18n from '../../i18n';
import { apiFetch } from '../../config/http';

// ============================================================
// Estilos
// ============================================================
const Card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px', marginBottom: 20 };
const Header = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 16 };
const H2 = { margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#111827' };
const Subtitle = { fontSize: '0.85rem', color: '#6b7280', marginTop: 4 };

const FiltersRow = { display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 };
const FieldBlock = { display: 'flex', flexDirection: 'column', gap: 4 };
const FieldLabel = { fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' };
const Input = { padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem', color: '#111827', background: '#fff', minWidth: 180 };
const Select = { ...Input, cursor: 'pointer', minWidth: 140 };

const BtnSecondary = { padding: '7px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 };
const BtnLink = { background: 'transparent', border: 'none', color: '#7c3aed', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: 0 };

const TableWrap = { overflowX: 'auto' };
const Table = { width: '100%', borderCollapse: 'collapse', minWidth: 900 };
const Th = { textAlign: 'left', padding: '10px 12px', fontWeight: 600, color: '#374151', background: '#f3f4f6', fontSize: '0.78rem', borderBottom: '1px solid #e5e7eb', textTransform: 'uppercase', letterSpacing: '0.03em' };
const Td = { padding: '10px 12px', color: '#111827', fontSize: '0.88rem', borderBottom: '1px solid #f3f4f6' };
const Empty = { padding: '32px 20px', textAlign: 'center', color: '#6b7280', fontSize: '0.95rem' };
const ErrorBox = { padding: '12px 16px', background: '#fee2e2', color: '#991b1b', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' };

const Pagination = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 12, flexWrap: 'wrap' };
const PageInfo = { fontSize: '0.85rem', color: '#6b7280' };
const PageBtn = (disabled) => ({ padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: disabled ? '#f3f4f6' : '#fff', color: disabled ? '#9ca3af' : '#374151', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '0.85rem' });

const badge = (variant) => {
  const map = {
    ok: { bg: '#dcfce7', fg: '#166534' },
    warn: { bg: '#fef3c7', fg: '#92400e' },
    danger: { bg: '#fee2e2', fg: '#991b1b' },
    info: { bg: '#e0e7ff', fg: '#3730a3' },
  };
  const c = map[variant] || map.info;
  return { display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600, background: c.bg, color: c.fg };
};

// KPI cards del detalle
const KpiGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 };
const KpiCard = { background: '#f9fafb', padding: '12px 14px', borderRadius: 8 };
const KpiLabel = { fontSize: '0.72rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.03em', fontWeight: 600 };
const KpiValue = { fontSize: '1.3rem', color: '#111827', fontWeight: 700, marginTop: 4 };

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

const kycBadge = (status) => {
  if (status === 'APPROVED') return <span style={badge('ok')}>KYC OK</span>;
  if (status === 'REJECTED') return <span style={badge('danger')}>KYC Rechazado</span>;
  return <span style={badge('warn')}>KYC Pendiente</span>;
};

// ============================================================
// Componente principal
// ============================================================
export default function AdminMastersPanel({ canManage = false }) {
  // Filtros aplicados
  const [q, setQ] = useState('');
  const [kycStatus, setKycStatus] = useState('');
  const [emailVerified, setEmailVerified] = useState(''); // '' | 'true' | 'false'
  const [contractAccepted, setContractAccepted] = useState('');
  const [suspended, setSuspended] = useState(''); // '' | 'true' | 'false'
  const [pageSize, setPageSize] = useState(20);

  const [page, setPage] = useState(0);
  const [data, setData] = useState({ items: [], page: 0, size: 20, totalPages: 0, totalElements: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Drill-down
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const buildQuery = useCallback((targetPage) => {
    const params = new URLSearchParams();
    params.set('page', String(targetPage));
    params.set('size', String(pageSize));
    if (q.trim()) params.set('q', q.trim());
    if (kycStatus) params.set('kycStatus', kycStatus);
    if (emailVerified === 'true' || emailVerified === 'false') params.set('emailVerified', emailVerified);
    if (contractAccepted === 'true' || contractAccepted === 'false') params.set('contractAccepted', contractAccepted);
    if (suspended === 'true' || suspended === 'false') params.set('suspended', suspended);
    return `/admin/masters?${params.toString()}`;
  }, [q, kycStatus, emailVerified, contractAccepted, suspended, pageSize]);

  const load = useCallback(async (targetPage) => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(buildQuery(targetPage));
      setData({
        items: Array.isArray(res?.items) ? res.items : [],
        page: res?.page ?? 0,
        size: res?.size ?? pageSize,
        totalPages: res?.totalPages ?? 0,
        totalElements: res?.totalElements ?? 0,
      });
    } catch (err) {
      setError(err?.data?.error || err?.message || t('admin.masters.errors.load'));
    } finally {
      setLoading(false);
    }
  }, [buildQuery, pageSize]);

  useEffect(() => { load(page); }, [load, page]);

  const applyFilters = () => {
    setPage(0);
    load(0);
  };

  const openDetail = async (userId) => {
    setSelectedId(userId);
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      const res = await apiFetch(`/admin/masters/${userId}`);
      setDetail(res);
    } catch (err) {
      setDetailError(err?.data?.error || err?.message || t('admin.masters.errors.loadDetail'));
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
    setDetailError('');
  };

  // === S7.b (2026-08-02): suspender / reactivar Master ===
  const [suspendModal, setSuspendModal] = useState(null); // {userId, nickname}
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendBusy, setSuspendBusy] = useState(false);

  const openSuspendModal = (m) => {
    setSuspendReason('');
    setSuspendModal({ userId: m.userId, nickname: m.nickname || `#${m.userId}` });
  };
  const closeSuspendModal = () => {
    setSuspendModal(null);
    setSuspendReason('');
    setSuspendBusy(false);
  };
  const confirmSuspend = async () => {
    if (!suspendModal || suspendBusy) return;
    setSuspendBusy(true);
    try {
      await apiFetch(`/admin/masters/${suspendModal.userId}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: suspendReason || null }),
      });
      closeSuspendModal();
      // Refrescar tanto listado como drill-down
      load(page);
      if (selectedId === suspendModal.userId) openDetail(suspendModal.userId);
    } catch (err) {
      alert(err?.data?.error || err?.message || 'Error al suspender el Master');
      setSuspendBusy(false);
    }
  };

  const handleReactivate = async (m) => {
    // eslint-disable-next-line no-restricted-globals
    if (!window.confirm(t('admin.masters.suspension.confirmReactivate', { defaultValue: '¿Reactivar el Master {{name}}? Las modelos que fueron liberadas NO se re-asignan automáticamente.', name: m.nickname || `#${m.userId}` }))) return;
    try {
      await apiFetch(`/admin/masters/${m.userId}/reactivate`, { method: 'POST' });
      load(page);
      if (selectedId === m.userId) openDetail(m.userId);
    } catch (err) {
      alert(err?.data?.error || err?.message || 'Error al reactivar el Master');
    }
  };

  const total = data.totalElements;

  return (
    <div>
      <div style={Card}>
        <div style={Header}>
          <div>
            <h2 style={H2}>{t('admin.masters.list.title', { defaultValue: 'Estudios registrados' })}</h2>
            <div style={Subtitle}>
              {t('admin.masters.list.subtitle', { defaultValue: 'Filtra por estado de onboarding para focalizar el trabajo.' })}
            </div>
          </div>
          <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
            {t('admin.masters.list.count', { defaultValue: '{{n}} estudios', n: total })}
          </div>
        </div>

        <div style={FiltersRow}>
          <div style={FieldBlock}>
            <span style={FieldLabel}>{t('admin.masters.filters.search', { defaultValue: 'Buscar' })}</span>
            <input
              type="text"
              style={Input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('admin.masters.filters.searchPlaceholder', { defaultValue: 'Introduce email, nickname o empresa' })}
            />
          </div>
          <div style={FieldBlock}>
            <span style={FieldLabel}>{t('admin.masters.filters.kyc', { defaultValue: 'KYC' })}</span>
            <select style={Select} value={kycStatus} onChange={(e) => setKycStatus(e.target.value)}>
              <option value="">{t('admin.masters.filters.all', { defaultValue: 'Todos' })}</option>
              <option value="APPROVED">APPROVED</option>
              <option value="PENDING">PENDING</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>
          <div style={FieldBlock}>
            <span style={FieldLabel}>{t('admin.masters.filters.emailVerified', { defaultValue: 'Email verificado' })}</span>
            <select style={Select} value={emailVerified} onChange={(e) => setEmailVerified(e.target.value)}>
              <option value="">{t('admin.masters.filters.all', { defaultValue: 'Todos' })}</option>
              <option value="true">{t('common.yes', { defaultValue: 'Sí' })}</option>
              <option value="false">{t('common.no', { defaultValue: 'No' })}</option>
            </select>
          </div>
          <div style={FieldBlock}>
            <span style={FieldLabel}>{t('admin.masters.filters.contract', { defaultValue: 'Contrato' })}</span>
            <select style={Select} value={contractAccepted} onChange={(e) => setContractAccepted(e.target.value)}>
              <option value="">{t('admin.masters.filters.all', { defaultValue: 'Todos' })}</option>
              <option value="true">{t('common.yes', { defaultValue: 'Sí' })}</option>
              <option value="false">{t('common.no', { defaultValue: 'No' })}</option>
            </select>
          </div>
          <div style={FieldBlock}>
            <span style={FieldLabel}>{t('admin.masters.filters.suspended', { defaultValue: 'Suspendido' })}</span>
            <select style={Select} value={suspended} onChange={(e) => setSuspended(e.target.value)}>
              <option value="">{t('admin.masters.filters.all', { defaultValue: 'Todos' })}</option>
              <option value="false">{t('admin.masters.filters.suspendedNo', { defaultValue: 'Solo activos' })}</option>
              <option value="true">{t('admin.masters.filters.suspendedYes', { defaultValue: 'Solo suspendidos' })}</option>
            </select>
          </div>
          <div style={FieldBlock}>
            <span style={FieldLabel}>{t('admin.masters.filters.pageSize', { defaultValue: 'Página' })}</span>
            <select style={Select} value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
          <button type="button" style={BtnSecondary} onClick={applyFilters} disabled={loading}>
            {t('admin.masters.filters.apply', { defaultValue: 'Aplicar' })}
          </button>
        </div>

        {error && <div style={ErrorBox} role="alert">{error}</div>}

        {loading && <div style={Empty}>{t('common.loading')}</div>}

        {!loading && data.items.length === 0 && (
          <div style={Empty}>{t('admin.masters.list.empty', { defaultValue: 'No hay estudios con los filtros aplicados.' })}</div>
        )}

        {!loading && data.items.length > 0 && (
          <>
            <div style={TableWrap}>
              <table style={Table}>
                <thead>
                  <tr>
                    <th style={Th}>{t('admin.masters.cols.id', { defaultValue: 'ID' })}</th>
                    <th style={Th}>{t('admin.masters.cols.nickname', { defaultValue: 'Nickname' })}</th>
                    <th style={Th}>{t('admin.masters.cols.email', { defaultValue: 'Email' })}</th>
                    <th style={Th}>{t('admin.masters.cols.company', { defaultValue: 'Empresa' })}</th>
                    <th style={Th}>{t('admin.masters.cols.emailVerified', { defaultValue: 'Email' })}</th>
                    <th style={Th}>{t('admin.masters.cols.kyc', { defaultValue: 'KYC' })}</th>
                    <th style={Th}>{t('admin.masters.cols.contract', { defaultValue: 'Contrato' })}</th>
                    <th style={{ ...Th, textAlign: 'right' }}>{t('admin.masters.cols.balance', { defaultValue: 'Saldo' })}</th>
                    <th style={{ ...Th, textAlign: 'right' }}>{t('admin.masters.cols.models', { defaultValue: 'Modelos' })}</th>
                    <th style={Th}>{t('admin.masters.cols.actions', { defaultValue: 'Acciones' })}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((m) => (
                    <tr key={m.userId} style={m.suspendedAt ? { background: 'rgba(220, 38, 38, 0.05)' } : undefined}>
                      <td style={{ ...Td, fontFamily: 'monospace', fontSize: '0.8rem', color: '#6b7280' }}>#{m.userId}</td>
                      <td style={{ ...Td, fontWeight: 600 }}>
                        {m.nickname || '—'}
                        {m.suspendedAt && (
                          <span style={{ ...badge('danger'), marginLeft: 6 }}>
                            {t('admin.masters.badges.suspended', { defaultValue: 'SUSPENDIDO' })}
                          </span>
                        )}
                      </td>
                      <td style={Td}>{m.email || '—'}</td>
                      <td style={Td}>
                        {m.companyName || '—'}
                        {m.companyCountry ? <span style={{ marginLeft: 6, color: '#6b7280', fontSize: '0.78rem' }}>({m.companyCountry})</span> : null}
                      </td>
                      <td style={Td}>
                        {m.emailVerified
                          ? <span style={badge('ok')}>{t('common.yes', { defaultValue: 'Sí' })}</span>
                          : <span style={badge('warn')}>{t('common.no', { defaultValue: 'No' })}</span>}
                      </td>
                      <td style={Td}>{kycBadge(m.verificationStatus)}</td>
                      <td style={Td}>
                        {m.contractAccepted
                          ? <span style={badge('ok')}>{t('common.yes', { defaultValue: 'Sí' })}</span>
                          : <span style={badge('warn')}>{t('common.no', { defaultValue: 'No' })}</span>}
                      </td>
                      <td style={{ ...Td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtEur(m.balanceCurrent)}</td>
                      <td style={{ ...Td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{m.totalModelsActive ?? 0}</td>
                      <td style={Td}>
                        <button type="button" style={BtnLink} onClick={() => openDetail(m.userId)}>
                          {t('admin.masters.actions.viewDetail', { defaultValue: 'Ver detalle' })}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={Pagination}>
              <div style={PageInfo}>
                {t('admin.masters.pagination.info', {
                  defaultValue: 'Página {{page}} de {{totalPages}} · {{total}} estudios',
                  page: data.page + 1,
                  totalPages: Math.max(1, data.totalPages),
                  total,
                })}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" style={PageBtn(page <= 0)} onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page <= 0}>
                  {t('common.previous', { defaultValue: 'Anterior' })}
                </button>
                <button type="button" style={PageBtn(page >= data.totalPages - 1)} onClick={() => setPage((p) => p + 1)} disabled={page >= data.totalPages - 1}>
                  {t('common.next', { defaultValue: 'Siguiente' })}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Drill-down inline (no modal) */}
      {selectedId && (
        <div style={Card}>
          <div style={Header}>
            <div>
              <h2 style={H2}>
                {detail?.master?.nickname || t('admin.masters.detail.title', { defaultValue: 'Detalle del Master' })}
                <span style={{ marginLeft: 8, fontSize: '0.85rem', color: '#6b7280', fontFamily: 'monospace' }}>#{selectedId}</span>
              </h2>
              {detail?.master?.email && (
                <div style={Subtitle}>{detail.master.email}</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {canManage && detail?.master && !detail.master.suspendedAt && (
                <button
                  type="button"
                  style={{ ...BtnSecondary, borderColor: '#dc2626', color: '#dc2626' }}
                  onClick={() => openSuspendModal(detail.master)}
                >
                  {t('admin.masters.actions.suspend', { defaultValue: 'Suspender' })}
                </button>
              )}
              {canManage && detail?.master && detail.master.suspendedAt && (
                <button
                  type="button"
                  style={{ ...BtnSecondary, borderColor: '#16a34a', color: '#16a34a' }}
                  onClick={() => handleReactivate(detail.master)}
                >
                  {t('admin.masters.actions.reactivate', { defaultValue: 'Reactivar' })}
                </button>
              )}
              <button type="button" style={BtnSecondary} onClick={closeDetail}>
                {t('common.close', { defaultValue: 'Cerrar' })}
              </button>
            </div>
          </div>

          {detail?.master?.suspendedAt && (
            <div style={{ ...ErrorBox, marginBottom: 20 }} role="alert">
              <strong>{t('admin.masters.suspension.bannerTitle', { defaultValue: 'Master suspendido' })}</strong>{' '}
              {t('admin.masters.suspension.since', { defaultValue: 'desde {{date}}', date: fmtDate(detail.master.suspendedAt) })}.
              {detail.master.suspensionReason && (
                <div style={{ marginTop: 6, fontSize: '0.85rem' }}>
                  {t('admin.masters.suspension.reasonLabel', { defaultValue: 'Motivo' })}: {detail.master.suspensionReason}
                </div>
              )}
            </div>
          )}

          {detailError && <div style={ErrorBox} role="alert">{detailError}</div>}

          {detailLoading && <div style={Empty}>{t('common.loading')}</div>}

          {!detailLoading && detail && (
            <>
              <div style={KpiGrid}>
                <div style={KpiCard}>
                  <div style={KpiLabel}>{t('admin.masters.kpi.balance', { defaultValue: 'Saldo actual' })}</div>
                  <div style={KpiValue}>{fmtEur(detail.master.balanceCurrent)}</div>
                </div>
                <div style={KpiCard}>
                  <div style={KpiLabel}>{t('admin.masters.kpi.billed30d', { defaultValue: 'Facturado 30d' })}</div>
                  <div style={KpiValue}>{fmtEur(detail.billedGrossEur30d)}</div>
                </div>
                <div style={KpiCard}>
                  <div style={KpiLabel}>{t('admin.masters.kpi.payouts30d', { defaultValue: 'Payouts 30d' })}</div>
                  <div style={KpiValue}>{detail.payoutRequestsLast30d}</div>
                </div>
                <div style={KpiCard}>
                  <div style={KpiLabel}>{t('admin.masters.kpi.totalPaidOut', { defaultValue: 'Total pagado' })}</div>
                  <div style={KpiValue}>{fmtEur(detail.master.totalPaidOutEur)}</div>
                </div>
                <div style={KpiCard}>
                  <div style={KpiLabel}>{t('admin.masters.kpi.modelsActive', { defaultValue: 'Modelos activas' })}</div>
                  <div style={KpiValue}>{detail.master.totalModelsActive ?? 0}</div>
                </div>
                <div style={KpiCard}>
                  <div style={KpiLabel}>{t('admin.masters.kpi.onboardedAt', { defaultValue: 'Alta' })}</div>
                  <div style={{ ...KpiValue, fontSize: '0.95rem' }}>{fmtDate(detail.master.onboardedAt || detail.master.createdAt)}</div>
                </div>
              </div>

              <h3 style={{ ...H2, fontSize: '1rem', marginTop: 16, marginBottom: 12 }}>
                {t('admin.masters.detail.modelsTitle', { defaultValue: 'Modelos bajo esta cuenta' })}
              </h3>

              {(!detail.models || detail.models.length === 0) && (
                <div style={Empty}>
                  {t('admin.masters.detail.modelsEmpty', { defaultValue: 'Sin modelos registradas todavía bajo este Master.' })}
                </div>
              )}

              {detail.models && detail.models.length > 0 && (
                <div style={TableWrap}>
                  <table style={Table}>
                    <thead>
                      <tr>
                        <th style={Th}>{t('admin.masters.modelsCols.id', { defaultValue: 'ID' })}</th>
                        <th style={Th}>{t('admin.masters.modelsCols.nickname', { defaultValue: 'Nickname' })}</th>
                        <th style={Th}>{t('admin.masters.modelsCols.kyc', { defaultValue: 'KYC' })}</th>
                        <th style={{ ...Th, textAlign: 'right' }}>{t('admin.masters.modelsCols.internalShare', { defaultValue: '% pactado' })}</th>
                        <th style={{ ...Th, textAlign: 'right' }}>{t('admin.masters.modelsCols.rate', { defaultValue: 'Tarifa €/min' })}</th>
                        <th style={Th}>{t('admin.masters.modelsCols.createdAt', { defaultValue: 'Alta' })}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.models.map((mm) => (
                        <tr key={mm.modelUserId}>
                          <td style={{ ...Td, fontFamily: 'monospace', fontSize: '0.8rem', color: '#6b7280' }}>#{mm.modelUserId}</td>
                          <td style={{ ...Td, fontWeight: 600 }}>{mm.nickname || '—'}</td>
                          <td style={Td}>{kycBadge(mm.verificationStatus)}</td>
                          <td style={{ ...Td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {mm.internalSharePct != null ? `${Number(mm.internalSharePct).toFixed(0)}%` : '—'}
                          </td>
                          <td style={{ ...Td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {mm.chosenRateEurPerMin != null ? fmtEur(mm.chosenRateEurPerMin) : '—'}
                          </td>
                          <td style={{ ...Td, fontSize: '0.82rem', color: '#6b7280' }}>{fmtDate(mm.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal suspender Master (S7.b) */}
      {suspendModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={closeSuspendModal}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 520, width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.25)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>
              {t('admin.masters.suspension.modalTitle', { defaultValue: 'Suspender Master' })}
            </h3>
            <div style={{ fontSize: '0.9rem', color: '#374151', marginBottom: 12 }}>
              {t('admin.masters.suspension.modalIntro', { defaultValue: 'Vas a suspender a {{name}}. Las modelos bajo su cuenta quedarán liberadas como individuales. El Master podrá loguearse y solicitar el payout final del saldo pre-suspensión, pero no podrá invitar modelos ni gestionar métodos ni splits.', name: suspendModal.nickname })}
            </div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              {t('admin.masters.suspension.reasonLabel', { defaultValue: 'Motivo' })}
            </label>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder={t('admin.masters.suspension.reasonPlaceholder', { defaultValue: 'Introduce el motivo (opcional pero recomendado)' })}
              maxLength={500}
              rows={4}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem', fontFamily: 'inherit', boxSizing: 'border-box' }}
              disabled={suspendBusy}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button type="button" style={BtnSecondary} onClick={closeSuspendModal} disabled={suspendBusy}>
                {t('common.cancel', { defaultValue: 'Cancelar' })}
              </button>
              <button type="button" style={{ ...BtnSecondary, background: '#dc2626', color: '#fff', borderColor: '#dc2626' }} onClick={confirmSuspend} disabled={suspendBusy}>
                {suspendBusy ? t('common.loading') : t('admin.masters.actions.suspend', { defaultValue: 'Suspender' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
