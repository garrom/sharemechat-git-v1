// Modal de escalado manual (B.2.1b).
// Se abre desde el botón "Hablar con un técnico" del header del chat.
// Al confirmar invoca hook.requestEscalation(reason). El cierre lo controla
// el padre.

import React, { useEffect, useRef, useState } from 'react';
import i18n from '../../i18n';

const REASON_MAX = 500;

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 3000,
};

const panelStyle = {
  background: '#fff',
  borderRadius: 8,
  padding: '20px 24px',
  width: 'min(480px, 92vw)',
  boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  fontFamily: 'inherit',
};

const titleStyle = {
  margin: '0 0 12px 0',
  fontSize: '1.15rem',
  fontWeight: 700,
  color: '#111827',
};

const textareaStyle = {
  width: '100%',
  minHeight: 96,
  padding: 10,
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontFamily: 'inherit',
  fontSize: '0.95rem',
  resize: 'vertical',
  boxSizing: 'border-box',
};

const actionsRow = {
  marginTop: 16,
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
};

const btnBase = {
  border: 'none',
  borderRadius: 6,
  padding: '8px 16px',
  fontSize: '0.95rem',
  cursor: 'pointer',
  fontWeight: 600,
};

const cancelBtnStyle = { ...btnBase, background: '#e5e7eb', color: '#111827' };
const confirmBtnStyle = { ...btnBase, background: '#f97316', color: '#fff' };

export default function SupportEscalateModal({ open, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setReason('');
      setBusy(false);
      setErr(null);
    } else {
      // Focus tras montar
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleConfirm = async () => {
    setBusy(true);
    setErr(null);
    try {
      await onConfirm?.(reason.trim());
      onClose?.();
    } catch (e) {
      setErr(e?.message || i18n.t('support.errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={overlayStyle} onClick={busy ? undefined : onClose} role="dialog" aria-modal="true">
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={titleStyle}>{i18n.t('support.escalate.modalTitle')}</h3>
        <textarea
          ref={textareaRef}
          style={textareaStyle}
          placeholder={i18n.t('support.escalate.reasonPlaceholder')}
          value={reason}
          maxLength={REASON_MAX}
          onChange={(e) => setReason(e.target.value)}
          disabled={busy}
        />
        {err && (
          <div style={{ marginTop: 8, color: '#b91c1c', fontSize: '0.9rem' }} role="alert">{err}</div>
        )}
        <div style={actionsRow}>
          <button type="button" style={cancelBtnStyle} onClick={onClose} disabled={busy}>
            {i18n.t('support.escalate.cancel')}
          </button>
          <button type="button" style={confirmBtnStyle} onClick={handleConfirm} disabled={busy}>
            {busy ? '…' : i18n.t('support.escalate.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
