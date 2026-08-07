// ADR-054 T4.3: modal cliente para abrir una nueva incidencia (D2 b1
// formulario explicito). Validaciones inline + mapeo de errores 400/429
// del backend. Al confirmar OK, ejecuta onCreated(ticket) para que el
// panel padre refresque el listado y navegue al detalle.

import React, { useEffect, useRef, useState } from 'react';
import i18n from '../../i18n';
import { createTicket } from '../../api/ticketsApi';

// Categorias sincronizadas con TicketService.VALID_CATEGORIES + CHECK V49
// (ADR-054 D8 Fase E, 2026-08-07 — estudio benchmark cam sites).
const CATEGORIES = [
  'STREAM_INTERRUPTED',
  'PAYMENT_NOT_CREDITED',
  'PAYOUT_ISSUE',
  'REFUND_REQUEST',
  'MODERATION_FALSE_POSITIVE',
  'ABUSE_REPORT',
  'KYC_VERIFICATION',
  'ACCOUNT_SECURITY',
  'ACCOUNT_ISSUE',
  'OTHER',
];

const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000,
};
const panelStyle = {
  background: '#fff', borderRadius: 8, padding: '20px 24px',
  width: 'min(520px, 94vw)', maxHeight: '92vh', overflowY: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.25)', fontFamily: 'inherit',
};
const titleStyle = { margin: '0 0 12px 0', fontSize: '1.15rem', fontWeight: 700, color: '#111827' };
const labelStyle = { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: 4 };
const fieldWrap = { marginBottom: 12 };
const inputStyle = {
  width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6,
  fontSize: '0.95rem', boxSizing: 'border-box',
};
const textareaStyle = { ...inputStyle, minHeight: 100, resize: 'vertical' };
const errorStyle = { color: '#b91c1c', fontSize: '0.85rem', marginTop: 8 };
const actionsRow = { marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 };
const btnBase = { border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: '0.95rem', cursor: 'pointer', fontWeight: 600 };
const cancelBtnStyle = { ...btnBase, background: '#e5e7eb', color: '#111827' };
const confirmBtnStyle = { ...btnBase, background: '#2563eb', color: '#fff' };

export default function NewTicketModal({ open, onClose, onCreated }) {
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [linkedStreamRecordId, setLinkedStreamRecordId] = useState('');
  const [linkedPaymentSessionId, setLinkedPaymentSessionId] = useState('');
  const [reportedIncidentAt, setReportedIncidentAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const firstFieldRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setCategory('');
      setDescription('');
      setLinkedStreamRecordId('');
      setLinkedPaymentSessionId('');
      setReportedIncidentAt('');
      setBusy(false);
      setErr(null);
    } else {
      setTimeout(() => firstFieldRef.current?.focus(), 20);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    setErr(null);
    if (!category) { setErr(i18n.t('support.tickets.errors.categoryRequired')); return; }
    if (!description || !description.trim()) {
      setErr(i18n.t('support.tickets.errors.descriptionRequired'));
      return;
    }
    setBusy(true);
    try {
      const payload = { category, description: description.trim() };
      if (linkedStreamRecordId) payload.linkedStreamRecordId = Number(linkedStreamRecordId);
      if (linkedPaymentSessionId) payload.linkedPaymentSessionId = Number(linkedPaymentSessionId);
      if (reportedIncidentAt) payload.reportedIncidentAt = reportedIncidentAt;
      const created = await createTicket(payload);
      onCreated && onCreated(created);
    } catch (ex) {
      const status = ex && ex.status;
      if (status === 429) {
        setErr(i18n.t('support.tickets.errors.rateLimited'));
      } else {
        setErr((ex && ex.message) || i18n.t('support.tickets.errors.createFailed'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true">
      <div style={panelStyle}>
        <h2 style={titleStyle}>{i18n.t('support.tickets.form.title')}</h2>

        <div style={fieldWrap}>
          <label style={labelStyle} htmlFor="ticket-category">
            {i18n.t('support.tickets.form.categoryLabel')}
          </label>
          <select
            id="ticket-category"
            ref={firstFieldRef}
            style={inputStyle}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={busy}
          >
            <option value="">{i18n.t('support.tickets.form.categoryPlaceholder')}</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{i18n.t(`support.tickets.categories.${c}`)}</option>
            ))}
          </select>
        </div>

        <div style={fieldWrap}>
          <label style={labelStyle} htmlFor="ticket-description">
            {i18n.t('support.tickets.form.descriptionLabel')}
          </label>
          <textarea
            id="ticket-description"
            style={textareaStyle}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={i18n.t('support.tickets.form.descriptionPlaceholder')}
            disabled={busy}
            maxLength={4000}
          />
        </div>

        <div style={fieldWrap}>
          <label style={labelStyle} htmlFor="ticket-when">
            {i18n.t('support.tickets.form.reportedIncidentAtLabel')}
          </label>
          <input
            id="ticket-when"
            type="datetime-local"
            style={inputStyle}
            value={reportedIncidentAt}
            onChange={(e) => setReportedIncidentAt(e.target.value)}
            disabled={busy}
          />
        </div>

        {(category === 'STREAM_INTERRUPTED') && (
          <div style={fieldWrap}>
            <label style={labelStyle} htmlFor="ticket-stream">
              {i18n.t('support.tickets.form.linkedStreamRecordIdLabel')}
            </label>
            <input
              id="ticket-stream"
              type="number"
              style={inputStyle}
              value={linkedStreamRecordId}
              onChange={(e) => setLinkedStreamRecordId(e.target.value)}
              disabled={busy}
              min="1"
            />
          </div>
        )}

        {(category === 'PAYMENT_NOT_CREDITED') && (
          <div style={fieldWrap}>
            <label style={labelStyle} htmlFor="ticket-payment">
              {i18n.t('support.tickets.form.linkedPaymentSessionIdLabel')}
            </label>
            <input
              id="ticket-payment"
              type="number"
              style={inputStyle}
              value={linkedPaymentSessionId}
              onChange={(e) => setLinkedPaymentSessionId(e.target.value)}
              disabled={busy}
              min="1"
            />
          </div>
        )}

        {err && <div style={errorStyle}>{err}</div>}

        <div style={actionsRow}>
          <button type="button" style={cancelBtnStyle} onClick={onClose} disabled={busy}>
            {i18n.t('support.tickets.form.cancel')}
          </button>
          <button type="button" style={confirmBtnStyle} onClick={handleSubmit} disabled={busy}>
            {busy ? '…' : i18n.t('support.tickets.form.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
