// ADR-054 T5.4: modal admin para compensar un ticket. Orquesta dos pasos
// atómicos hacia el backend:
//   1. PATCH /api/admin/tickets/{id}/status -> RESOLVED_COMPENSATED_PENDING_CREDIT
//   2. POST /api/admin/finance/refund/{userId} con ticketId -> acredita
//      saldo + cierra ticket como RESOLVED_COMPENSATED con FK a la Transaction
//
// Si el paso 2 falla el ticket queda en el estado intermedio y el admin
// puede reintentar sin re-editar el importe.

import React, { useEffect, useRef, useState } from 'react';
import i18n from '../../../i18n';
import { transitionStatus, compensateTicket } from '../../../api/adminTicketsApi';

const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000,
};
const panelStyle = {
  background: '#fff', borderRadius: 8, padding: '20px 24px',
  width: 'min(480px, 92vw)', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  fontFamily: 'inherit',
};
const titleStyle = { margin: '0 0 12px 0', fontSize: '1.15rem', fontWeight: 700, color: '#111827' };
const labelStyle = { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: 4 };
const fieldWrap = { marginBottom: 12 };
const inputStyle = {
  width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6,
  fontSize: '0.95rem', boxSizing: 'border-box',
};
const hintStyle = { fontSize: '0.8rem', color: '#6b7280', marginTop: 4 };
const errorStyle = { color: '#b91c1c', fontSize: '0.85rem', marginTop: 8 };
const actionsRow = { marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 };
const btnBase = { border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: '0.95rem', cursor: 'pointer', fontWeight: 600 };
const cancelBtn = { ...btnBase, background: '#e5e7eb', color: '#111827' };
const confirmBtn = { ...btnBase, background: '#059669', color: '#fff' };

export default function CompensateTicketModal({ open, ticket, onClose, onCompensated }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const amountRef = useRef(null);

  useEffect(() => {
    if (open) {
      setAmount('');
      setReason('');
      setBusy(false);
      setErr(null);
      setTimeout(() => amountRef.current?.focus(), 20);
    }
  }, [open]);

  if (!open || !ticket) return null;

  const parsedAmount = Number(amount);
  const minutesApprox = parsedAmount > 0 ? parsedAmount : 0;

  const handleSubmit = async () => {
    setErr(null);
    if (!parsedAmount || parsedAmount <= 0) {
      setErr(i18n.t('support.tickets.errors.descriptionRequired', { defaultValue: 'Amount required' }));
      return;
    }
    if (!reason || !reason.trim()) {
      setErr(i18n.t('admin.support.tickets.detail.notesRequired'));
      return;
    }
    setBusy(true);
    try {
      // Paso 1: PATCH status -> PENDING_CREDIT (skip si ya lo esta).
      if (ticket.status !== 'RESOLVED_COMPENSATED_PENDING_CREDIT') {
        await transitionStatus(ticket.id, 'RESOLVED_COMPENSATED_PENDING_CREDIT', reason.trim());
      }
      // Paso 2: refund + cierre atomico backend.
      await compensateTicket({
        userId: ticket.userId,
        ticketId: ticket.id,
        amount: parsedAmount,
        reason: reason.trim(),
      });
      onCompensated && onCompensated();
    } catch (ex) {
      setErr((ex && ex.message) || i18n.t('admin.support.tickets.errors.compensateFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true">
      <div style={panelStyle}>
        <h2 style={titleStyle}>
          {i18n.t('admin.support.tickets.compensate.modalTitle', { id: ticket.id })}
        </h2>

        <div style={fieldWrap}>
          <label style={labelStyle} htmlFor="comp-amount">
            {i18n.t('admin.support.tickets.compensate.amountLabel')}
          </label>
          <input
            id="comp-amount"
            ref={amountRef}
            type="number"
            step="0.01"
            min="0.01"
            max="1000"
            style={inputStyle}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={busy}
          />
          {parsedAmount > 0 && (
            <div style={hintStyle}>
              {i18n.t('admin.support.tickets.compensate.amountHint', { minutes: minutesApprox })}
            </div>
          )}
        </div>

        <div style={fieldWrap}>
          <label style={labelStyle} htmlFor="comp-reason">
            {i18n.t('admin.support.tickets.compensate.reasonLabel')}
          </label>
          <textarea
            id="comp-reason"
            style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={busy}
            maxLength={500}
          />
        </div>

        {err && <div style={errorStyle}>{err}</div>}

        <div style={actionsRow}>
          <button type="button" style={cancelBtn} onClick={onClose} disabled={busy}>
            {i18n.t('admin.support.tickets.compensate.cancel')}
          </button>
          <button type="button" style={confirmBtn} onClick={handleSubmit} disabled={busy}>
            {busy ? '…' : i18n.t('admin.support.tickets.compensate.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
