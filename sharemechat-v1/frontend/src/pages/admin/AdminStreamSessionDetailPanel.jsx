import React, { useCallback, useEffect, useState } from 'react';
import i18n from '../../i18n';

const wrap = { padding: 16, maxWidth: 1280 };
const section = { background: '#fff', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 12 };
const h3 = { margin: 0, marginBottom: 8, fontSize: '0.95rem', fontWeight: 600, color: '#1e3a8a' };
const btn = (variant) => ({
  padding: '6px 14px',
  borderRadius: 6,
  border: '1px solid ' + (variant === 'ghost' ? '#1e3a8a' : '#1e3a8a'),
  background: variant === 'ghost' ? '#fff' : '#1e3a8a',
  color: variant === 'ghost' ? '#1e3a8a' : '#fff',
  cursor: 'pointer',
  fontSize: '0.85rem',
});
const meta = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 6, fontSize: '0.85rem' };
const metaItem = { background: '#f8fafc', padding: '6px 10px', borderRadius: 4 };
const labelTag = { color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' };

const formatDate = (s) => s ? String(s).replace('T', ' ').replace(/:\d{2}\.\d+/, '') : '—';

const SeverityBadge = ({ s }) => {
  const colors = {
    GREEN: ['#dcfce7', '#166534'],
    AMBER: ['#fef3c7', '#854d0e'],
    RED: ['#fecaca', '#7f1d1d'],
    CRITICAL: ['#fee2e2', '#7f1d1d'],
  };
  const [bg, fg] = colors[s] || ['#f1f5f9', '#475569'];
  return <span style={{ background: bg, color: fg, padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600 }}>{s || '—'}</span>;
};

const AdminStreamSessionDetailPanel = ({ sessionId, onBack }) => {
  const t = (key, opts) => i18n.t(key, opts);
  const [detail, setDetail] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [evidenceByEvent, setEvidenceByEvent] = useState({}); // {eventId: {url, reason, loading}}
  const [payloadModal, setPayloadModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const r = await fetch('/api/admin/compliance/sessions/' + sessionId, { credentials: 'include' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      setDetail(await r.json());
    } catch (e) {
      setErr(e.message || 'Error');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  const loadEvidence = async (eventId) => {
    setEvidenceByEvent((prev) => ({ ...prev, [eventId]: { loading: true } }));
    try {
      const r = await fetch('/api/admin/compliance/evidence/' + eventId + '/signed-url', { credentials: 'include' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const dto = await r.json();
      setEvidenceByEvent((prev) => ({ ...prev, [eventId]: { url: dto.url, reason: dto.reason, expiresAt: dto.expiresAt } }));
    } catch (e) {
      setEvidenceByEvent((prev) => ({ ...prev, [eventId]: { error: e.message || 'Error' } }));
    }
  };

  const loadPayload = async (eventId) => {
    try {
      const r = await fetch('/api/admin/stream-moderation/sessions/' + sessionId, { credentials: 'include' });
      if (!r.ok) {
        setPayloadModal({ eventId, raw: '(payload endpoint not available: HTTP ' + r.status + ')' });
        return;
      }
      const data = await r.json();
      const ev = (data.events || data.frames || []).find((x) => x.id === eventId || x.eventId === eventId);
      setPayloadModal({ eventId, raw: ev ? JSON.stringify(ev, null, 2) : '(event not found in session response)' });
    } catch (e) {
      setPayloadModal({ eventId, raw: '(error: ' + (e.message || 'Error') + ')' });
    }
  };

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <button onClick={onBack} style={btn('ghost')}>← {t('admin.compliance.actions.back', { defaultValue: 'Back' })}</button>
        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{t('admin.compliance.session.title', { defaultValue: 'Session detail' })} #{sessionId}</h2>
        <button onClick={load} style={btn('ghost')} disabled={loading}>{loading ? '...' : t('admin.compliance.actions.reload', { defaultValue: 'Reload' })}</button>
      </div>

      {err && <div style={{ background: '#fef2f2', padding: '8px 12px', borderRadius: 6, color: '#7f1d1d', marginBottom: 12 }}>{err}</div>}

      {detail && (
        <>
          <section style={section}>
            <h3 style={h3}>{t('admin.compliance.session.metadata', { defaultValue: 'Metadata' })}</h3>
            <div style={meta}>
              <div style={metaItem}><div style={labelTag}>Stream ID</div>#{detail.streamRecordId}</div>
              <div style={metaItem}><div style={labelTag}>Provider</div>{detail.provider}</div>
              <div style={metaItem}><div style={labelTag}>Status</div>{detail.status}</div>
              <div style={metaItem}><div style={labelTag}>Cadence (s)</div>{detail.samplingCadenceSeconds}</div>
              <div style={metaItem}><div style={labelTag}>Started</div>{formatDate(detail.startedAt)}</div>
              <div style={metaItem}><div style={labelTag}>Stopped</div>{formatDate(detail.stoppedAt)}</div>
              <div style={metaItem}><div style={labelTag}>Frames</div>{detail.framesSubmitted}/{detail.verdictsReceived}</div>
              <div style={metaItem}><div style={labelTag}>Degraded since</div>{formatDate(detail.degradedSince)}</div>
            </div>
          </section>

          <section style={section}>
            <h3 style={h3}>{t('admin.compliance.session.frames', { defaultValue: 'Frame timeline' })} ({(detail.frames || []).length})</h3>
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>Event ID</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>Provider event</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>Type</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>Received</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>Processed</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.frames || []).map((f) => {
                    const ev = evidenceByEvent[f.eventId];
                    return (
                      <tr key={f.eventId} style={{ borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' }}>
                        <td style={{ padding: '6px 8px' }}>#{f.eventId}</td>
                        <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: '0.78rem' }}>{f.providerEventId || '—'}</td>
                        <td style={{ padding: '6px 8px' }}>{f.eventType}</td>
                        <td style={{ padding: '6px 8px' }}>{formatDate(f.receivedAt)}</td>
                        <td style={{ padding: '6px 8px' }}>{formatDate(f.processedAt)}</td>
                        <td style={{ padding: '6px 8px' }}>
                          {!ev && <button style={btn('ghost')} onClick={() => loadEvidence(f.eventId)}>{t('admin.compliance.evidence.load', { defaultValue: 'View evidence' })}</button>}
                          {ev?.loading && <span style={{ color: '#94a3b8' }}>...</span>}
                          {ev?.error && <span style={{ color: '#7f1d1d', fontSize: '0.78rem' }}>{ev.error}</span>}
                          {ev && !ev.loading && !ev.error && ev.url && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <img src={ev.url} alt="evidence" style={{ maxWidth: 160, maxHeight: 90, borderRadius: 4, border: '1px solid #e2e8f0' }} />
                              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>expires {formatDate(ev.expiresAt)}</span>
                            </div>
                          )}
                          {ev && !ev.loading && !ev.error && !ev.url && (
                            <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{ev.reason || 'no evidence'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {(detail.frames || []).length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 12, textAlign: 'center', color: '#94a3b8' }}>(no frames)</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section style={section}>
            <h3 style={h3}>{t('admin.compliance.session.reviews', { defaultValue: 'Reviews generated' })} ({(detail.reviews || []).length})</h3>
            {(detail.reviews || []).length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{t('admin.compliance.session.noReviews', { defaultValue: 'No reviews generated (all GREEN).' })}</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px' }}>ID</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px' }}>Severity</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px' }}>Category</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px' }}>Score</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px' }}>Evidence ref</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px' }}>Created</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px' }}>Reviewed</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.reviews || []).map((r) => (
                    <tr key={r.reviewId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 8px' }}>#{r.reviewId}</td>
                      <td style={{ padding: '6px 8px' }}><SeverityBadge s={r.severity} /></td>
                      <td style={{ padding: '6px 8px' }}>{r.category}</td>
                      <td style={{ padding: '6px 8px' }}>{r.score}</td>
                      <td style={{ padding: '6px 8px' }}>{r.status}</td>
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: '0.75rem' }}>{r.evidenceRef || '—'}</td>
                      <td style={{ padding: '6px 8px' }}>{formatDate(r.createdAt)}</td>
                      <td style={{ padding: '6px 8px' }}>{formatDate(r.reviewedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      {payloadModal && (
        <div onClick={() => setPayloadModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', padding: 20, borderRadius: 8, maxWidth: '80vw', maxHeight: '80vh', overflow: 'auto' }}>
            <h3 style={h3}>Payload event #{payloadModal.eventId}</h3>
            <pre style={{ background: '#f8fafc', padding: 12, fontSize: '0.78rem' }}>{payloadModal.raw}</pre>
            <button style={btn()} onClick={() => setPayloadModal(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStreamSessionDetailPanel;
