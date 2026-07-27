// ADR-054 T5.3: detalle admin de un ticket. Metadatos + panel de
// verificacion (POST /verify que devuelve JSON estructurado) + acciones
// segun estado actual (transiciones D6 validas) + compensacion via modal.

import React, { useCallback, useEffect, useState } from 'react';
import i18n from '../../../i18n';
import {
  getTicket,
  verifyTicket,
  transitionStatus,
} from '../../../api/adminTicketsApi';
import CompensateTicketModal from './CompensateTicketModal';

const wrap = { padding: '16px 20px' };
const headerRow = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  gap: 12, marginBottom: 16, flexWrap: 'wrap',
};
const title = { fontSize: 18, fontWeight: 700, color: '#f8fafc', margin: 0 };
const sub = { fontSize: 12, color: '#9ca3af', marginTop: 4 };
const card = {
  background: '#1e293b', border: '1px solid #334155', borderRadius: 10,
  padding: 14, marginBottom: 14, color: '#e2e8f0', fontSize: 13,
};
const cardTitle = { fontSize: 13, fontWeight: 700, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 };
const metaGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 };
const metaLabel = { fontSize: 10, opacity: 0.7, textTransform: 'uppercase' };
const descBox = { marginTop: 10, background: '#0f172a', padding: 10, borderRadius: 6, whiteSpace: 'pre-wrap', fontSize: 13, color: '#e2e8f0' };
const jsonBox = { background: '#0f172a', padding: 10, borderRadius: 6, fontFamily: 'monospace', fontSize: 12, color: '#cbd5e1', overflow: 'auto', maxHeight: 320 };
const btnRow = { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 };
const errBox = { padding: 10, background: '#5a1a1e', borderRadius: 8, color: '#fecaca', border: '1px solid #b91c1c', marginBottom: 12, fontSize: 13 };

const btn = (variant = 'primary', disabled = false) => {
  const map = {
    primary:   { bg: '#2563eb', fg: '#fff' },
    secondary: { bg: '#3f4a5a', fg: '#fff' },
    success:   { bg: '#059669', fg: '#fff' },
    warn:      { bg: '#d97706', fg: '#fff' },
    danger:    { bg: '#b91c1c', fg: '#fff' },
    ghost:     { bg: 'transparent', fg: '#cbd5e1', border: '1px solid #475569' },
  };
  const c = map[variant] || map.primary;
  return {
    padding: '7px 14px', borderRadius: 6,
    border: c.border || 'none',
    background: disabled ? '#4b5563' : c.bg,
    color: disabled ? '#e5e7eb' : c.fg,
    fontSize: 13, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
};

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
    display: 'inline-block', padding: '3px 10px', borderRadius: 999,
    fontSize: 12, fontWeight: 600, background: c.bg, color: c.fg,
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
    display: 'inline-block', padding: '3px 10px', borderRadius: 999,
    fontSize: 11, fontWeight: 700, background: c.bg, color: c.fg,
  };
};

function formatDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function AdminTicketDetail({ ticketId, onBack, onChanged }) {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [notes, setNotes] = useState('');
  const [busyAction, setBusyAction] = useState(false);
  const [compensateOpen, setCompensateOpen] = useState(false);

  const load = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    setErr(null);
    try {
      const t = await getTicket(ticketId);
      setTicket(t);
    } catch (ex) {
      setErr((ex && ex.message) || i18n.t('admin.support.tickets.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { load(); }, [load]);

  const handleVerify = async () => {
    if (!ticket) return;
    setVerifying(true);
    setErr(null);
    try {
      await verifyTicket(ticket.id);
      await load();
    } catch (ex) {
      setErr((ex && ex.message) || i18n.t('admin.support.tickets.errors.verifyFailed'));
    } finally {
      setVerifying(false);
    }
  };

  const doTransition = async (newStatus, requireNotes = false) => {
    if (!ticket) return;
    if (requireNotes && (!notes || !notes.trim())) {
      setErr(i18n.t('admin.support.tickets.detail.notesRequired'));
      return;
    }
    setBusyAction(true);
    setErr(null);
    try {
      await transitionStatus(ticket.id, newStatus, notes.trim() || null);
      setNotes('');
      await load();
      onChanged && onChanged();
    } catch (ex) {
      setErr((ex && ex.message) || i18n.t('admin.support.tickets.errors.transitionFailed'));
    } finally {
      setBusyAction(false);
    }
  };

  const handleCompensated = async () => {
    setCompensateOpen(false);
    await load();
    onChanged && onChanged();
  };

  if (loading && !ticket) return <div style={wrap}>{i18n.t('admin.support.tickets.loading')}</div>;
  if (!ticket) return (
    <div style={wrap}>
      {err && <div style={errBox}>{err}</div>}
      <button type="button" style={btn('secondary')} onClick={onBack}>
        {i18n.t('admin.support.tickets.detail.back')}
      </button>
    </div>
  );

  const cat = i18n.t(`admin.support.tickets.categories.${ticket.category}`, { defaultValue: ticket.category });
  const st = i18n.t(`admin.support.tickets.statuses.${ticket.status}`, { defaultValue: ticket.status });
  const sig = ticket.verificationLastSignal
    ? i18n.t(`admin.support.tickets.signals.${ticket.verificationLastSignal}`, { defaultValue: ticket.verificationLastSignal })
    : i18n.t('admin.support.tickets.signals.unknown');

  // Acciones disponibles segun estado (D6 backend enforca).
  const canInvestigate = ticket.status === 'OPEN';
  const canCompensate = ticket.status === 'INVESTIGATING' || ticket.status === 'RESOLVED_COMPENSATED_PENDING_CREDIT';
  const canResolveNoComp = ticket.status === 'INVESTIGATING';
  const canReject = ticket.status === 'OPEN';
  const canAbandon = ticket.status === 'INVESTIGATING';

  let parsedVerify = null;
  if (ticket.verificationLastResultJson) {
    try { parsedVerify = JSON.parse(ticket.verificationLastResultJson); } catch { parsedVerify = null; }
  }

  return (
    <div style={wrap}>
      <div style={headerRow}>
        <div>
          <h2 style={title}>{i18n.t('admin.support.tickets.detail.title', { id: ticket.id })}</h2>
          <div style={sub}>{formatDate(ticket.createdAt)}</div>
        </div>
        <button type="button" style={btn('ghost')} onClick={onBack}>
          {i18n.t('admin.support.tickets.detail.back')}
        </button>
      </div>

      {err && <div style={errBox}>{err}</div>}

      <div style={card}>
        <div style={cardTitle}>{i18n.t('admin.support.tickets.detail.description')}</div>
        <div style={metaGrid}>
          <div>
            <div style={metaLabel}>{i18n.t('admin.support.tickets.listHeaders.user')}</div>
            <div>#{ticket.userId}</div>
          </div>
          <div>
            <div style={metaLabel}>{i18n.t('admin.support.tickets.listHeaders.category')}</div>
            <div>{cat}</div>
          </div>
          <div>
            <div style={metaLabel}>{i18n.t('admin.support.tickets.listHeaders.status')}</div>
            <div><span style={statusPillStyle(ticket.status)}>{st}</span></div>
          </div>
          <div>
            <div style={metaLabel}>{i18n.t('admin.support.tickets.listHeaders.signal')}</div>
            <div><span style={signalPillStyle(ticket.verificationLastSignal)}>{sig}</span></div>
          </div>
          {ticket.linkedStreamRecordId && (
            <div>
              <div style={metaLabel}>{i18n.t('admin.support.tickets.detail.linkedStream')}</div>
              <div>#{ticket.linkedStreamRecordId}</div>
            </div>
          )}
          {ticket.linkedPaymentSessionId && (
            <div>
              <div style={metaLabel}>{i18n.t('admin.support.tickets.detail.linkedPayment')}</div>
              <div>#{ticket.linkedPaymentSessionId}</div>
            </div>
          )}
          {ticket.compensatedAmountEur && (
            <div>
              <div style={metaLabel}>{i18n.t('admin.support.tickets.detail.compensationLabel')}</div>
              <div>{i18n.t('admin.support.tickets.detail.compensationLinked', {
                txId: ticket.compensatedTransactionId, amount: ticket.compensatedAmountEur
              })}</div>
            </div>
          )}
        </div>
        <div style={descBox}>{ticket.description}</div>
      </div>

      <div style={card}>
        <div style={{ ...cardTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{i18n.t('admin.support.tickets.detail.verificationTitle')}</span>
          <button type="button" style={btn('primary', verifying)} onClick={handleVerify} disabled={verifying}>
            {verifying
              ? i18n.t('admin.support.tickets.detail.verifyRunning')
              : i18n.t('admin.support.tickets.detail.verifyButton')}
          </button>
        </div>
        {parsedVerify ? (
          <pre style={jsonBox}>{JSON.stringify(parsedVerify, null, 2)}</pre>
        ) : (
          <div style={{ color: '#94a3b8', fontSize: 13 }}>
            {i18n.t('admin.support.tickets.detail.verificationNever')}
          </div>
        )}
      </div>

      {(canInvestigate || canCompensate || canResolveNoComp || canReject || canAbandon) && (
        <div style={card}>
          <div style={cardTitle}>{i18n.t('admin.support.tickets.detail.actionsTitle')}</div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#cbd5e1', marginBottom: 4 }}>
              {i18n.t('admin.support.tickets.detail.resolutionNotes')}
            </label>
            <textarea
              style={{ width: '100%', minHeight: 60, padding: 8, borderRadius: 6, border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={i18n.t('admin.support.tickets.detail.notesPlaceholder')}
              disabled={busyAction}
              maxLength={500}
            />
          </div>
          <div style={btnRow}>
            {canInvestigate && (
              <button type="button" style={btn('primary', busyAction)} onClick={() => doTransition('INVESTIGATING', false)} disabled={busyAction}>
                {i18n.t('admin.support.tickets.detail.actionInvestigate')}
              </button>
            )}
            {canCompensate && (
              <button type="button" style={btn('success', busyAction)} onClick={() => setCompensateOpen(true)} disabled={busyAction}>
                {i18n.t('admin.support.tickets.detail.actionCompensate')}
              </button>
            )}
            {canResolveNoComp && (
              <button type="button" style={btn('secondary', busyAction)} onClick={() => doTransition('RESOLVED_NO_COMPENSATION', true)} disabled={busyAction}>
                {i18n.t('admin.support.tickets.detail.actionResolveNoComp')}
              </button>
            )}
            {canReject && (
              <button type="button" style={btn('danger', busyAction)} onClick={() => doTransition('REJECTED_INVALID', true)} disabled={busyAction}>
                {i18n.t('admin.support.tickets.detail.actionReject')}
              </button>
            )}
            {canAbandon && (
              <button type="button" style={btn('warn', busyAction)} onClick={() => doTransition('ABANDONED', false)} disabled={busyAction}>
                {i18n.t('admin.support.tickets.detail.actionAbandon')}
              </button>
            )}
          </div>
        </div>
      )}

      <CompensateTicketModal
        open={compensateOpen}
        ticket={ticket}
        onClose={() => setCompensateOpen(false)}
        onCompensated={handleCompensated}
      />
    </div>
  );
}
