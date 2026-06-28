import React, { useEffect, useState } from 'react';
import i18n from '../../i18n';

const STATUSES = ['ALL', 'OPEN', 'ACKNOWLEDGED', 'REVIEWING', 'RESOLVED', 'REJECTED', 'ESCALATED'];
const CATEGORIES = ['ALL', 'CSAM', 'NON_CONSENSUAL', 'MINOR_AT_RISK', 'HATE_SYMBOLS',
  'COPYRIGHT', 'ILLEGAL', 'HARASSMENT', 'IMPERSONATION', 'FRAUD', 'OTHER'];
const DECISIONS = ['', 'CONTENT_REMOVED', 'USER_SUSPENDED', 'USER_BANNED', 'NO_ACTION',
  'INSUFFICIENT_INFO', 'ESCALATED_TO_AUTHORITIES', 'FORWARDED_TO_NCMEC'];

const PageWrap = { padding: 16, maxWidth: 1200 };
const ToolbarRow = { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 };
const Select = { padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db' };
const StatsRow = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
  gap: 8, marginBottom: 16,
};
const StatCard = (variant) => ({
  background:
    variant === 'breach' ? '#fef2f2'
    : variant === 'near' ? '#fef3c7'
    : '#f8fafc',
  border:
    '1px solid '
    + (variant === 'breach' ? '#fecaca' : variant === 'near' ? '#fde68a' : '#e2e8f0'),
  borderRadius: 8, padding: '10px 12px',
});
const StatLabel = { fontSize: '0.78rem', color: '#64748b' };
const StatValue = { fontSize: '1.3rem', fontWeight: 600, color: '#0f172a' };

const Table = { width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' };
const Th = { textAlign: 'left', padding: '8px 6px', borderBottom: '2px solid #e2e8f0', color: '#475569' };
const Td = { padding: '8px 6px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' };

const BadgeStyle = (sla) => ({
  display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem',
  fontWeight: 600,
  background: sla === 'BREACH' ? '#fee2e2' : sla === 'NEAR' ? '#fef3c7' : '#dcfce7',
  color: sla === 'BREACH' ? '#7f1d1d' : sla === 'NEAR' ? '#854d0e' : '#166534',
  border: '1px solid '
    + (sla === 'BREACH' ? '#fca5a5' : sla === 'NEAR' ? '#fcd34d' : '#86efac'),
});

const DetailWrap = { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, marginTop: 12 };
const SmallBtn = (variant) => ({
  padding: '6px 12px', borderRadius: 6, border: '1px solid '
    + (variant === 'danger' ? '#dc2626' : '#1e3a8a'),
  background: variant === 'danger' ? '#dc2626' : '#1e3a8a',
  color: '#fff', cursor: 'pointer', fontSize: '0.85rem',
});

const formatDate = (s) => s ? String(s).replace('T', ' ').replace(/:\d{2}\.\d+/, '') : '—';

const AdminComplaintsPanel = ({ canReview = false }) => {
  const t = (key, opts) => i18n.t(key, opts);
  const [status, setStatus] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [selected, setSelected] = useState(null);  // detail
  const [reviewStatus, setReviewStatus] = useState('REVIEWING');
  const [reviewDecision, setReviewDecision] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const loadList = async () => {
    setLoading(true);
    setErr('');
    try {
      const qs = new URLSearchParams();
      if (status !== 'ALL') qs.append('status', status);
      if (category !== 'ALL') qs.append('category', category);
      const url = `/api/admin/complaints${qs.toString() ? '?' + qs.toString() : ''}`;
      const [listRes, statsRes] = await Promise.all([
        fetch(url, { credentials: 'include' }),
        fetch('/api/admin/complaints/stats', { credentials: 'include' }),
      ]);
      if (!listRes.ok) throw new Error('Error cargando lista');
      if (!statsRes.ok) throw new Error('Error cargando stats');
      setRows(await listRes.json());
      setStats(await statsRes.json());
    } catch (e) {
      setErr(e.message || 'Error');
      setRows([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id) => {
    try {
      const r = await fetch(`/api/admin/complaints/${id}`, { credentials: 'include' });
      if (!r.ok) throw new Error('Error cargando detalle');
      const d = await r.json();
      setSelected(d);
      setReviewStatus(d.status || 'REVIEWING');
      setReviewDecision(d.decisionCode || '');
      setReviewNotes(d.decisionNotes || '');
    } catch (e) {
      setErr(e.message || 'Error');
    }
  };

  const submitReview = async () => {
    if (!selected) return;
    setErr('');
    try {
      const r = await fetch(`/api/admin/complaints/${selected.id}/review`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newStatus: reviewStatus,
          decisionCode: reviewDecision || null,
          notes: reviewNotes || null,
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => null);
        throw new Error(data?.error || 'Error en review');
      }
      await loadList();
      await loadDetail(selected.id);
    } catch (e) {
      setErr(e.message || 'Error');
    }
  };

  const escalate = async () => {
    if (!selected) return;
    setErr('');
    try {
      const r = await fetch(`/api/admin/complaints/${selected.id}/escalate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: reviewNotes || null }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => null);
        throw new Error(data?.error || 'Error en escalate');
      }
      await loadList();
      await loadDetail(selected.id);
    } catch (e) {
      setErr(e.message || 'Error');
    }
  };

  useEffect(() => { loadList(); /* eslint-disable-next-line */ }, [status, category]);

  return (
    <div style={PageWrap}>
      <div style={ToolbarRow}>
        <div>
          <label style={{ marginRight: 6, fontSize: '0.85rem' }}>Status:</label>
          <select style={Select} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={{ marginRight: 6, fontSize: '0.85rem' }}>Category:</label>
          <select style={Select} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={loadList} style={SmallBtn()} disabled={loading}>{loading ? '...' : 'Recargar'}</button>
      </div>

      {stats && (
        <div style={StatsRow}>
          <div style={StatCard()}><div style={StatLabel}>Total</div><div style={StatValue}>{stats.total}</div></div>
          <div style={StatCard()}><div style={StatLabel}>Open</div><div style={StatValue}>{stats.open}</div></div>
          <div style={StatCard()}><div style={StatLabel}>Reviewing</div><div style={StatValue}>{stats.reviewing}</div></div>
          <div style={StatCard()}><div style={StatLabel}>Resolved</div><div style={StatValue}>{stats.resolved}</div></div>
          <div style={StatCard()}><div style={StatLabel}>Escalated</div><div style={StatValue}>{stats.escalated}</div></div>
          <div style={StatCard('near')}><div style={StatLabel}>SLA Near</div><div style={StatValue}>{stats.slaNear}</div></div>
          <div style={StatCard('breach')}><div style={StatLabel}>SLA Breach</div><div style={StatValue}>{stats.slaBreached}</div></div>
        </div>
      )}

      {err && <div style={{ background: '#fef2f2', padding: '8px 12px', borderRadius: 6, color: '#7f1d1d', marginBottom: 8 }}>{err}</div>}

      <table style={Table}>
        <thead>
          <tr>
            <th style={Th}>ID</th>
            <th style={Th}>Category</th>
            <th style={Th}>Status</th>
            <th style={Th}>SLA</th>
            <th style={Th}>Created</th>
            <th style={Th}>Expected</th>
            <th style={Th}>Reporter</th>
            <th style={Th}>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ background: selected && selected.id === r.id ? '#eef2ff' : 'transparent' }}>
              <td style={Td}>#{r.id}</td>
              <td style={Td}>{r.category}</td>
              <td style={Td}>{r.status}</td>
              <td style={Td}><span style={BadgeStyle(r.slaState)}>{r.slaState}</span></td>
              <td style={Td}>{formatDate(r.createdAt)}</td>
              <td style={Td}>{formatDate(r.expectedResolutionAt)}</td>
              <td style={Td}>{r.reporterEmail || '—'}</td>
              <td style={Td}><button style={SmallBtn()} onClick={() => loadDetail(r.id)}>Open</button></td>
            </tr>
          ))}
          {rows.length === 0 && !loading && (
            <tr><td colSpan={8} style={{ ...Td, textAlign: 'center', color: '#94a3b8' }}>(sin resultados)</td></tr>
          )}
        </tbody>
      </table>

      {selected && (
        <div style={DetailWrap}>
          <h3 style={{ marginTop: 0 }}>Complaint #{selected.id} &mdash; {selected.category}</h3>
          <div><strong>Status:</strong> {selected.status} &nbsp; <strong>SLA:</strong> <span style={BadgeStyle(selected.slaState)}>{selected.slaState}</span></div>
          <div><strong>Created:</strong> {formatDate(selected.createdAt)} &nbsp; <strong>Expected resolution:</strong> {formatDate(selected.expectedResolutionAt)}</div>
          {selected.reporterEmail && <div><strong>Reporter:</strong> {selected.reporterEmail} {selected.reporterName ? '(' + selected.reporterName + ')' : ''}</div>}
          {selected.subjectUserId && <div><strong>Subject user id:</strong> {selected.subjectUserId}</div>}
          {selected.subjectStreamRecordId && <div><strong>Subject stream id:</strong> {selected.subjectStreamRecordId}</div>}
          {selected.subjectEmail && <div><strong>Subject email:</strong> {selected.subjectEmail}</div>}
          {selected.subjectUrl && <div><strong>Subject URL:</strong> <a href={selected.subjectUrl} target="_blank" rel="noreferrer">{selected.subjectUrl}</a></div>}
          <div style={{ marginTop: 8 }}>
            <strong>Description:</strong>
            <pre style={{ background: '#fff', padding: 8, border: '1px solid #e2e8f0', borderRadius: 4, whiteSpace: 'pre-wrap' }}>{selected.description}</pre>
          </div>

          {selected.auditLog && selected.auditLog.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <strong>Audit log:</strong>
              <ul style={{ fontSize: '0.85rem', color: '#475569' }}>
                {selected.auditLog.map((a) => (
                  <li key={a.id}>
                    [{formatDate(a.createdAt)}] {a.action} {a.fromStatus} → {a.toStatus} {a.actorUserId ? '(actor=' + a.actorUserId + ')' : '(system)'}{a.notes ? ' — ' + a.notes : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {canReview && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <hr />
              <strong>Review:</strong>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem' }}>New status</label>
                  <select style={Select} value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)}>
                    {STATUSES.filter((s) => s !== 'ALL').map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem' }}>Decision code</label>
                  <select style={Select} value={reviewDecision} onChange={(e) => setReviewDecision(e.target.value)}>
                    {DECISIONS.map((d) => <option key={d} value={d}>{d || '(none)'}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem' }}>Notes</label>
                <textarea style={{ width: '100%', minHeight: 80, padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}
                  value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} maxLength={2000} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={SmallBtn()} onClick={submitReview}>Save review</button>
                <button style={SmallBtn('danger')} onClick={escalate}>Escalate</button>
                <button style={{ ...SmallBtn(), background: '#fff', color: '#1e3a8a' }} onClick={() => setSelected(null)}>Close</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminComplaintsPanel;
