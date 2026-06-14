import React, { useState } from 'react';
import i18n from '../i18n';
import { useSession } from './SessionProvider';
import { apiFetch } from '../config/http';

const tk = (key) => i18n.t(key);

/**
 * Banner persistente, no obtrusivo, visible cuando el user logueado tiene
 * email_verified_at = NULL. Frente "Email verification gate total"
 * (2026-06-15).
 *
 * Se inserta arriba de los 4 dashboards (DashboardClient, DashboardUserClient,
 * DashboardUserModel, DashboardModel). Mantiene un boton "Reenviar email"
 * que llama POST /api/email-verification/resend.
 *
 * Coexiste con EmailNotVerifiedModalBridge: el modal se dispara al intentar
 * una accion gateada (403); el banner es informativo continuo. Los dos
 * usan el mismo endpoint de reenvio.
 */
const EmailNotVerifiedBanner = () => {
  const { user } = useSession();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null); // { kind: 'success'|'error', text }

  if (!user) return null;
  if (user.emailVerifiedAt) return null;

  const handleResend = async () => {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      await apiFetch('/email-verification/resend', { method: 'POST' });
      setFeedback({ kind: 'success', text: tk('emailVerification.modal.resend.success') });
    } catch (e) {
      setFeedback({
        kind: 'error',
        text: (e && e.data && e.data.message) || tk('emailVerification.modal.resend.error'),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="status"
      style={{
        backgroundColor: '#fff3cd',
        color: '#664d03',
        borderBottom: '1px solid #ffecb5',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 14,
        flexWrap: 'wrap',
      }}
    >
      <span style={{ flex: '1 1 auto' }}>{tk('emailVerification.banner.text')}</span>
      <button
        type="button"
        onClick={handleResend}
        disabled={busy}
        style={{
          backgroundColor: '#664d03',
          color: '#fff',
          border: 'none',
          padding: '6px 12px',
          borderRadius: 4,
          cursor: busy ? 'wait' : 'pointer',
          fontWeight: 600,
        }}
      >
        {busy ? '…' : tk('emailVerification.banner.cta')}
      </button>
      {feedback ? (
        <span
          style={{
            flex: '1 1 100%',
            marginTop: 4,
            color: feedback.kind === 'success' ? '#0f5132' : '#842029',
          }}
        >
          {feedback.text}
        </span>
      ) : null}
    </div>
  );
};

export default EmailNotVerifiedBanner;
