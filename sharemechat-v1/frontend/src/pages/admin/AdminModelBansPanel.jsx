import React, { useCallback, useEffect, useMemo, useState } from 'react';
import i18n from '../../i18n';

/*
 * ADR-037 frente trial-sfw Bloque 4: panel del backoffice para revisar
 * bans automaticos emitidos por el motor sobre modelos con strikes CRITICAL
 * en trials. Vista tabla + drill-down con evidencia S3 signed URL y
 * acciones Lift/Keep para bans con requires_manual_review=true.
 */

const wrap = { padding: 16, maxWidth: 1280 };
const toolbar = { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' };
const btn = (variant) => ({
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid ' + (variant === 'danger' ? '#dc2626' : variant === 'success' ? '#16a34a' : '#1e3a8a'),
  background: variant === 'ghost' ? '#fff' : (variant === 'danger' ? '#dc2626' : variant === 'success' ? '#16a34a' : '#1e3a8a'),
  color: variant === 'ghost' ? '#1e3a8a' : '#fff',
  cursor: 'pointer',
  fontSize: '0.85rem',
  fontWeight: 600,
});
const chip = (color, bg, border) => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 999,
  background: bg,
  color: color,
  border: '1px solid ' + border,
  fontSize: '0.72rem',
  fontWeight: 600,
  marginLeft: 6,
});
const section = { background: '#fff', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 14 };
const h3 = { margin: 0, marginBottom: 10, fontSize: '0.95rem', fontWeight: 600, color: '#1e3a8a' };

const formatDate = (s) => s ? String(s).replace('T', ' ').replace(/:\d{2}\.\d+/, '') : '—';

const AdminModelBansPanel = ({ canModerate }) => {
  const t = (key, opts) => i18n.t(key, opts);
  const [filter, setFilter] = useState('pending_review');
  const [rows, setRows] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const r = await fetch('/api/admin/model-bans?filter=' + encodeURIComponent(filter), { credentials: 'include' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      setRows(await r.json());
    } catch (e) {
      setErr(e.message || 'Error');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (banId) => {
    setLoading(true);
    setErr('');
    try {
      const r = await fetch('/api/admin/model-bans/' + banId, { credentials: 'include' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      setDetail(await r.json());
    } catch (e) {
      setErr(e.message || 'Error');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  const act = async (banId, action) => {
    if (!canModerate) return;
    if (!window.confirm(t('admin.modelBans.confirm.' + action,
        { defaultValue: action === 'lift' ? 'Levantar el ban?' : 'Confirmar (mantener) el ban?' }))) return;
    try {
      const r = await fetch('/api/admin/model-bans/' + banId + '/' + action, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      await load();
      if (detail && detail.id === banId) {
        await openDetail(banId);
      }
    } catch (e) {
      alert((e.message || 'Error') + '');
    }
  };

  const filterButtons = useMemo(() => ([
    { key: 'pending_review', label: t('admin.modelBans.filter.pendingReview', { defaultValue: 'Pendientes revisión' }) },
    { key: 'active', label: t('admin.modelBans.filter.active', { defaultValue: 'Activos' }) },
    { key: 'all', label: t('admin.modelBans.filter.all', { defaultValue: 'Todos' }) },
  ]), []);

  if (detail) {
    const canAct = canModerate && detail.requiresManualReview && !detail.reviewed;
    return (
      <div style={wrap}>
        <div style={toolbar}>
          <button onClick={() => setDetail(null)} style={btn('ghost')}>
            ← {t('admin.modelBans.back', { defaultValue: 'Volver' })}
          </button>
          {canAct && (
            <>
              <button onClick={() => act(detail.id, 'lift')} style={btn('success')}>
                {t('admin.modelBans.actions.lift', { defaultValue: 'Levantar ban' })}
              </button>
              <button onClick={() => act(detail.id, 'keep')} style={btn()}>
                {t('admin.modelBans.actions.keep', { defaultValue: 'Mantener ban' })}
              </button>
            </>
          )}
          {detail.reviewed && (
            <span style={chip('#166534', '#dcfce7', '#bbf7d0')}>
              {t('admin.modelBans.reviewed', { defaultValue: 'Revisado' })}
            </span>
          )}
        </div>

        {err && <div style={{ background: '#fef2f2', padding: '8px 12px', borderRadius: 6, color: '#7f1d1d', marginBottom: 12 }}>{err}</div>}

        <section style={section}>
          <h3 style={h3}>{t('admin.modelBans.detail.model', { defaultValue: 'Modelo' })}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 4, fontSize: '0.88rem' }}>
            <div style={{ color: '#64748b' }}>ID</div><div>{detail.modelUserId}</div>
            <div style={{ color: '#64748b' }}>Nickname</div><div>{detail.modelNickname || '—'}</div>
            <div style={{ color: '#64748b' }}>Email</div><div>{detail.modelEmail || '—'}</div>
          </div>
        </section>

        <section style={section}>
          <h3 style={h3}>{t('admin.modelBans.detail.ban', { defaultValue: 'Ban actual' })}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 4, fontSize: '0.88rem' }}>
            <div style={{ color: '#64748b' }}>{t('admin.modelBans.col.strike', { defaultValue: 'Ordinal de strike' })}</div><div>{detail.strikeCountAtBan}</div>
            <div style={{ color: '#64748b' }}>{t('admin.modelBans.col.reason', { defaultValue: 'Motivo' })}</div><div>{detail.reason}</div>
            <div style={{ color: '#64748b' }}>{t('admin.modelBans.col.startedAt', { defaultValue: 'Inicio' })}</div><div>{formatDate(detail.banStartedAt)}</div>
            <div style={{ color: '#64748b' }}>{t('admin.modelBans.col.endsAt', { defaultValue: 'Fin' })}</div>
            <div>
              {formatDate(detail.banEndsAt)}
              {detail.active
                ? <span style={chip('#7f1d1d', '#fef2f2', '#fecaca')}>{t('admin.modelBans.active', { defaultValue: 'Activo' })}</span>
                : <span style={chip('#166534', '#dcfce7', '#bbf7d0')}>{t('admin.modelBans.expired', { defaultValue: 'Expirado' })}</span>}
            </div>
            <div style={{ color: '#64748b' }}>{t('admin.modelBans.col.manualReview', { defaultValue: 'Revisión manual' })}</div>
            <div>{detail.requiresManualReview ? (t('admin.modelBans.yes', { defaultValue: 'Sí' })) : (t('admin.modelBans.no', { defaultValue: 'No' }))}</div>
            {detail.reviewed && (<>
              <div style={{ color: '#64748b' }}>{t('admin.modelBans.col.reviewedAt', { defaultValue: 'Revisado el' })}</div><div>{formatDate(detail.reviewedAt)}</div>
              <div style={{ color: '#64748b' }}>{t('admin.modelBans.col.reviewedBy', { defaultValue: 'Revisado por' })}</div><div>userId {detail.reviewedBy}</div>
            </>)}
          </div>
        </section>

        <section style={section}>
          <h3 style={h3}>{t('admin.modelBans.detail.evidence', { defaultValue: 'Evidencia' })}</h3>
          {detail.evidenceUrl ? (
            <div>
              <p style={{ fontSize: '0.82rem', color: '#475569', margin: '0 0 8px' }}>
                {t('admin.modelBans.evidenceHint', { defaultValue: 'URL firmada temporal del frame que disparó el strike origen.' })}
              </p>
              <a href={detail.evidenceUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#1e3a8a', fontSize: '0.85rem' }}>
                {t('admin.modelBans.viewEvidence', { defaultValue: 'Ver evidencia (imagen)' })}
              </a>
              {detail.evidenceExpiresAt && (
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 4 }}>
                  {t('admin.modelBans.evidenceExpires', { defaultValue: 'Expira:' })} {formatDate(detail.evidenceExpiresAt)}
                </div>
              )}
            </div>
          ) : (
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>
              {t('admin.modelBans.noEvidence', { defaultValue: 'Sin evidencia disponible (bucket no configurado o frame no capturado).' })}
            </p>
          )}
        </section>

        <section style={section}>
          <h3 style={h3}>{t('admin.modelBans.detail.strikes', { defaultValue: 'Strikes recientes (ventana 30d)' })}</h3>
          {(!detail.strikesInWindow || detail.strikesInWindow.length === 0) ? (
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>
              {t('admin.modelBans.noStrikes', { defaultValue: '(sin strikes en la ventana)' })}
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>ID</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>Session</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>Severity</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>Category</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {detail.strikesInWindow.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '6px 8px' }}>{s.id}</td>
                    <td style={{ padding: '6px 8px' }}>{s.streamModerationSessionId}</td>
                    <td style={{ padding: '6px 8px' }}>{s.severity}</td>
                    <td style={{ padding: '6px 8px' }}>{s.category}</td>
                    <td style={{ padding: '6px 8px' }}>{formatDate(s.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={toolbar}>
        {filterButtons.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              ...btn(f.key === filter ? undefined : 'ghost'),
              opacity: loading ? 0.7 : 1,
            }}
            disabled={loading}
          >
            {f.label}
          </button>
        ))}
        <button onClick={load} style={btn('ghost')} disabled={loading}>
          {loading ? '...' : t('admin.modelBans.reload', { defaultValue: 'Recargar' })}
        </button>
      </div>

      {err && <div style={{ background: '#fef2f2', padding: '8px 12px', borderRadius: 6, color: '#7f1d1d', marginBottom: 12 }}>{err}</div>}

      <section style={section}>
        {rows.length === 0 ? (
          <p style={{ fontSize: '0.9rem', color: '#94a3b8', margin: 0 }}>
            {t('admin.modelBans.empty', { defaultValue: '(sin resultados para este filtro)' })}
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>ID</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>{t('admin.modelBans.col.model', { defaultValue: 'Modelo' })}</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>{t('admin.modelBans.col.strike', { defaultValue: 'Strike' })}</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>{t('admin.modelBans.col.reason', { defaultValue: 'Motivo' })}</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>{t('admin.modelBans.col.startedAt', { defaultValue: 'Inicio' })}</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>{t('admin.modelBans.col.endsAt', { defaultValue: 'Fin' })}</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>{t('admin.modelBans.col.status', { defaultValue: 'Estado' })}</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '6px 8px' }}>{r.id}</td>
                  <td style={{ padding: '6px 8px' }}>{r.modelNickname || '—'} <span style={{ color: '#94a3b8' }}>#{r.modelUserId}</span></td>
                  <td style={{ padding: '6px 8px' }}>{r.strikeCountAtBan}</td>
                  <td style={{ padding: '6px 8px' }}>{r.reason}</td>
                  <td style={{ padding: '6px 8px' }}>{formatDate(r.banStartedAt)}</td>
                  <td style={{ padding: '6px 8px' }}>{formatDate(r.banEndsAt)}</td>
                  <td style={{ padding: '6px 8px' }}>
                    {r.active
                      ? <span style={chip('#7f1d1d', '#fef2f2', '#fecaca')}>{t('admin.modelBans.active', { defaultValue: 'Activo' })}</span>
                      : <span style={chip('#166534', '#dcfce7', '#bbf7d0')}>{t('admin.modelBans.expired', { defaultValue: 'Expirado' })}</span>}
                    {r.requiresManualReview && !r.reviewed && (
                      <span style={chip('#7c2d12', '#fed7aa', '#fdba74')}>{t('admin.modelBans.pendingReview', { defaultValue: 'Pendiente' })}</span>
                    )}
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <button onClick={() => openDetail(r.id)} style={btn('ghost')}>
                      {t('admin.modelBans.detailBtn', { defaultValue: 'Detalle' })}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

export default AdminModelBansPanel;
