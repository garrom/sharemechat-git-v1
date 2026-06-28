import React, { useCallback, useEffect, useMemo, useState } from 'react';
import i18n from '../../i18n';
import AdminStreamSessionDetailPanel from './AdminStreamSessionDetailPanel';

const wrap = { padding: 16, maxWidth: 1280 };
const toolbar = { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' };
const btn = (variant) => ({
  padding: '6px 14px',
  borderRadius: 6,
  border: '1px solid ' + (variant === 'danger' ? '#dc2626' : '#1e3a8a'),
  background: variant === 'ghost' ? '#fff' : (variant === 'danger' ? '#dc2626' : '#1e3a8a'),
  color: variant === 'ghost' ? '#1e3a8a' : '#fff',
  cursor: 'pointer',
  fontSize: '0.85rem',
});
const cardsRow = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: 10,
  marginBottom: 16,
};
const Card = ({ label, value, sub, variant }) => (
  <div style={{
    padding: '12px 14px',
    background: variant === 'critical' ? '#fef2f2' : variant === 'good' ? '#ecfdf5' : '#f8fafc',
    border: '1px solid ' + (variant === 'critical' ? '#fecaca' : variant === 'good' ? '#a7f3d0' : '#e2e8f0'),
    borderRadius: 8,
  }}>
    <div style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#0f172a', marginTop: 4 }}>{value}</div>
    {sub && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
  </div>
);

const section = { background: '#fff', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 };
const h3 = { margin: 0, marginBottom: 10, fontSize: '0.95rem', fontWeight: 600, color: '#1e3a8a' };

// Mini bar chart inline SVG. Recibe { label: count } y dibuja barras horizontales.
const BarChart = ({ data, palette, max }) => {
  const entries = Object.entries(data || {});
  if (entries.length === 0) return <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>(sin datos)</div>;
  const computedMax = max || Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div>
      {entries.map(([k, v]) => {
        const pct = Math.round((v / computedMax) * 100);
        const color = palette && palette[k] ? palette[k] : '#1e3a8a';
        return (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 110, fontSize: '0.78rem', color: '#475569' }}>{k}</div>
            <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 14, position: 'relative' }}>
              <div style={{ width: pct + '%', background: color, height: '100%', borderRadius: 4 }} />
            </div>
            <div style={{ width: 40, textAlign: 'right', fontSize: '0.85rem', fontWeight: 600 }}>{v}</div>
          </div>
        );
      })}
    </div>
  );
};

const SEVERITY_PALETTE = { GREEN: '#16a34a', AMBER: '#d97706', RED: '#dc2626', CRITICAL: '#7f1d1d' };
const SLA_PALETTE = { OK: '#16a34a', NEAR: '#d97706', BREACH: '#dc2626', CLOSED: '#64748b' };
const STATUS_PALETTE = {
  ACTIVE: '#16a34a', SUSPENDED: '#d97706', BANNED: '#7f1d1d',
  OPEN: '#1e3a8a', PENDING: '#1e3a8a', REVIEWING: '#0891b2',
  RESOLVED: '#16a34a', REJECTED: '#7f1d1d', ESCALATED: '#dc2626',
};

const formatDate = (s) => s ? String(s).replace('T', ' ').replace(/:\d{2}\.\d+/, '') : '—';

const AdminComplianceDashboardPanel = () => {
  const t = (key, opts) => i18n.t(key, opts);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [drillSessionId, setDrillSessionId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const r = await fetch('/api/admin/compliance/dashboard', { credentials: 'include' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      setData(await r.json());
    } catch (e) {
      setErr(e.message || 'Error');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const downloadCsv = async () => {
    try {
      const r = await fetch('/api/admin/compliance/export/csv', { credentials: 'include' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const text = await r.text();
      const blob = new Blob([text], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'compliance-dashboard-last-30-days.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e.message || 'Error CSV');
    }
  };

  if (drillSessionId) {
    return <AdminStreamSessionDetailPanel
      sessionId={drillSessionId}
      onBack={() => setDrillSessionId(null)} />;
  }

  const w30 = data?.last30Days;
  const w7 = data?.last7Days;
  const wMonth = data?.currentMonth;

  return (
    <div style={wrap}>
      <div style={toolbar}>
        <button onClick={load} style={btn()} disabled={loading}>
          {loading ? '...' : t('admin.compliance.actions.reload', { defaultValue: 'Reload' })}
        </button>
        <button onClick={downloadCsv} style={btn('ghost')} disabled={loading}>
          {t('admin.compliance.actions.csv', { defaultValue: 'Download CSV (last 30 days)' })}
        </button>
        {data && (
          <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: '0.8rem' }}>
            {t('admin.compliance.generatedAt', { defaultValue: 'Generated:' })} {formatDate(data.generatedAt)}
          </span>
        )}
      </div>

      {err && <div style={{ background: '#fef2f2', padding: '8px 12px', borderRadius: 6, color: '#7f1d1d', marginBottom: 12 }}>{err}</div>}

      {data && (
        <>
          <section style={section}>
            <h3 style={h3}>{t('admin.compliance.cards.last7Days', { defaultValue: 'Last 7 days' })}</h3>
            <div style={cardsRow}>
              <Card label={t('admin.compliance.cards.sessions', { defaultValue: 'Sessions' })} value={w7?.sessionsModerated ?? 0} />
              <Card label={t('admin.compliance.cards.frames', { defaultValue: 'Frames' })} value={w7?.framesAnalyzed ?? 0} />
              <Card label="SIGHTENGINE" value={w7?.sessionsSightengine ?? 0} sub={'MOCK: ' + (w7?.sessionsMock ?? 0)} />
              <Card label={t('admin.compliance.cards.degraded', { defaultValue: 'Degraded' })} value={w7?.sessionsDegraded ?? 0} variant={(w7?.sessionsDegraded || 0) > 0 ? 'critical' : 'good'} />
            </div>
          </section>

          <section style={section}>
            <h3 style={h3}>{t('admin.compliance.cards.last30Days', { defaultValue: 'Last 30 days' })}</h3>
            <div style={cardsRow}>
              <Card label={t('admin.compliance.cards.sessions', { defaultValue: 'Sessions' })} value={w30?.sessionsModerated ?? 0} />
              <Card label={t('admin.compliance.cards.frames', { defaultValue: 'Frames' })} value={w30?.framesAnalyzed ?? 0} />
              <Card label="SIGHTENGINE" value={w30?.sessionsSightengine ?? 0} sub={'MOCK: ' + (w30?.sessionsMock ?? 0)} />
              <Card label={t('admin.compliance.cards.degraded', { defaultValue: 'Degraded' })} value={w30?.sessionsDegraded ?? 0} variant={(w30?.sessionsDegraded || 0) > 0 ? 'critical' : 'good'} />
              <Card label={t('admin.compliance.cards.reviewLatency', { defaultValue: 'Avg review latency (min)' })} value={w30?.reviewResolutionAvgMinutes ?? '—'} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 8 }}>
              <div>
                <h3 style={h3}>{t('admin.compliance.cards.reviewsBySeverity', { defaultValue: 'Reviews by severity (30d)' })}</h3>
                <BarChart data={w30?.reviewsBySeverity} palette={SEVERITY_PALETTE} />
              </div>
              <div>
                <h3 style={h3}>{t('admin.compliance.cards.complaintsBySla', { defaultValue: 'Complaints by SLA (30d)' })}</h3>
                <BarChart data={w30?.complaintsBySla} palette={SLA_PALETTE} />
              </div>
            </div>
          </section>

          <section style={section}>
            <h3 style={h3}>{t('admin.compliance.cards.currentMonth', { defaultValue: 'Current month' })}</h3>
            <div style={cardsRow}>
              <Card label={t('admin.compliance.cards.sessions', { defaultValue: 'Sessions' })} value={wMonth?.sessionsModerated ?? 0} />
              <Card label={t('admin.compliance.cards.frames', { defaultValue: 'Frames' })} value={wMonth?.framesAnalyzed ?? 0} />
              <Card label="SIGHTENGINE" value={wMonth?.sessionsSightengine ?? 0} sub={'MOCK: ' + (wMonth?.sessionsMock ?? 0)} />
            </div>
          </section>

          <section style={section}>
            <h3 style={h3}>{t('admin.compliance.cards.accountStatusSnapshot', { defaultValue: 'Account status snapshot' })}</h3>
            <BarChart data={data.accountStatusSnapshot} palette={STATUS_PALETTE} />
          </section>

          <section style={section}>
            <h3 style={h3}>{t('admin.compliance.timeline.title', { defaultValue: 'Timeline (last 7 days)' })}</h3>
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>Type</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>Ref</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>Detail</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>Timestamp</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.timeline7Days || []).length === 0 && (
                    <tr><td colSpan={5} style={{ padding: 12, textAlign: 'center', color: '#94a3b8' }}>{t('admin.compliance.timeline.empty', { defaultValue: '(no events)' })}</td></tr>
                  )}
                  {(data.timeline7Days || []).map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 8px' }}>{row.type}</td>
                      <td style={{ padding: '6px 8px' }}>#{row.refId}</td>
                      <td style={{ padding: '6px 8px' }}>{row.detail || '—'}</td>
                      <td style={{ padding: '6px 8px' }}>{formatDate(row.ts)}</td>
                      <td style={{ padding: '6px 8px' }}>
                        {row.type === 'SESSION_STARTED' && (
                          <button style={btn('ghost')} onClick={() => setDrillSessionId(row.refId)}>
                            {t('admin.compliance.actions.drillDown', { defaultValue: 'Drill-down' })}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default AdminComplianceDashboardPanel;
