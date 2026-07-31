// MasterModelosPanel.jsx — ADR-056 Fase S5.a.7.
// Panel de gestion de modelos bajo umbrella del Master.
// Tabla + modal invitar (email + nickname) + modal editar % pactado.
// Consume masterApi (endpoints S4 backend ya existentes).
import React, { useCallback, useEffect, useState } from 'react';
import i18n from '../../i18n';
import masterApi from '../../api/masterApi';

// ============================================================
// Estilos inline (patron consistente con DashboardMaster).
// ============================================================
const Card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px' };
const Header = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 };
const H2 = { margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#111827' };
const BtnPrimary = {
  appearance: 'none', border: 0, background: '#7c3aed', color: '#fff',
  padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
  fontSize: '0.9rem', fontWeight: 600,
};
const BtnSecondary = {
  appearance: 'none', background: 'transparent', color: '#7c3aed',
  border: '1px solid #7c3aed', padding: '6px 12px', borderRadius: 6,
  cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
};
const BtnGhost = { ...BtnSecondary, border: '1px solid #9ca3af', color: '#374151' };
const BtnDanger = { ...BtnSecondary, borderColor: '#dc2626', color: '#dc2626' };

const TableWrap = { overflowX: 'auto' };
const Table = { width: '100%', borderCollapse: 'collapse', minWidth: 720 };
const Th = { textAlign: 'left', padding: '10px 12px', fontWeight: 600, color: '#374151', background: '#f3f4f6', fontSize: '0.82rem', borderBottom: '1px solid #e5e7eb', textTransform: 'uppercase', letterSpacing: '0.03em' };
const Td = { padding: '10px 12px', color: '#111827', fontSize: '0.92rem', borderBottom: '1px solid #f3f4f6' };
const Badge = (bg, fg) => ({ display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 600, background: bg, color: fg });

const Empty = { padding: '32px 20px', textAlign: 'center', color: '#6b7280', fontSize: '0.95rem' };
const ErrorBox = { padding: '12px 16px', background: '#fee2e2', color: '#991b1b', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' };
const OkBox = { padding: '12px 16px', background: '#d1fae5', color: '#065f46', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' };

// Modal overlay
const Overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 };
const Modal = { background: '#fff', borderRadius: 12, padding: '24px', maxWidth: 480, width: '100%', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' };
const ModalTitle = { margin: '0 0 12px', fontSize: '1.15rem', fontWeight: 700, color: '#111827' };
const Field = { marginTop: 12 };
const Label = { fontSize: '0.85rem', color: '#374151', marginBottom: 4 };
const Input = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ccc', fontSize: '0.95rem', color: '#000', boxSizing: 'border-box' };
const FormError = { color: '#b00020', fontSize: '0.85rem', marginTop: 6 };
const ModalActions = { marginTop: 20, display: 'flex', gap: 8, justifyContent: 'flex-end' };

// ============================================================
// Helpers
// ============================================================
const fmtEur = (n) => {
  if (n == null) return '—';
  try {
    return new Intl.NumberFormat(i18n.language || 'es', {
      style: 'currency', currency: 'EUR', maximumFractionDigits: 2,
    }).format(Number(n));
  } catch { return `${Number(n).toFixed(2)} €`; }
};
const fmtPct = (n) => n == null ? '—' : `${Number(n).toFixed(2)} %`;
const fmtHours = (n) => n == null ? '—' : `${Number(n).toFixed(2)} h`;

const kycBadge = (s) => {
  if (s === 'APPROVED') return <span style={Badge('#d1fae5', '#065f46')}>{i18n.t('masterDashboard.modelos.kyc.approved')}</span>;
  if (s === 'REJECTED') return <span style={Badge('#fee2e2', '#991b1b')}>{i18n.t('masterDashboard.modelos.kyc.rejected')}</span>;
  return <span style={Badge('#fef3c7', '#92400e')}>{i18n.t('masterDashboard.modelos.kyc.pending')}</span>;
};
const activeBadge = (active) => active
  ? <span style={Badge('#d1fae5', '#065f46')}>{i18n.t('masterDashboard.modelos.status.active')}</span>
  : <span style={Badge('#e5e7eb', '#4b5563')}>{i18n.t('masterDashboard.modelos.status.inactive')}</span>;

const t = (k, opts) => i18n.t(k, opts);

// ============================================================
// Sub-componente: Modal Invitar Modelo
// ============================================================
function InviteModal({ open, onClose, onInvited }) {
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setEmail(''); setNickname(''); setError(''); };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setError('');
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(t('masterDashboard.modelos.invite.errors.emailInvalid'));
      return;
    }
    if (!nickname.trim() || nickname.trim().length < 3) {
      setError(t('masterDashboard.modelos.invite.errors.nicknameRequired'));
      return;
    }
    setSubmitting(true);
    try {
      await masterApi.inviteModel({
        modelEmail: email.trim().toLowerCase(),
        modelNickname: nickname.trim(),
      });
      onInvited();
      reset();
      onClose();
    } catch (err) {
      setError(err?.data?.error || err?.message || t('masterDashboard.modelos.invite.errors.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;
  return (
    <div style={Overlay} onClick={handleClose}>
      <form style={Modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3 style={ModalTitle}>{t('masterDashboard.modelos.invite.title')}</h3>
        <p style={{ fontSize: '0.88rem', color: '#6b7280', margin: 0 }}>
          {t('masterDashboard.modelos.invite.subtitle')}
        </p>

        <div style={Field}>
          <div style={Label}>{t('masterDashboard.modelos.invite.email')}</div>
          <input
            style={Input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('masterDashboard.modelos.invite.emailPlaceholder')}
            autoFocus
          />
        </div>

        <div style={Field}>
          <div style={Label}>{t('masterDashboard.modelos.invite.nickname')}</div>
          <input
            style={Input}
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder={t('masterDashboard.modelos.invite.nicknamePlaceholder')}
          />
        </div>

        {error && <div style={FormError}>{error}</div>}

        <div style={ModalActions}>
          <button type="button" style={BtnGhost} onClick={handleClose} disabled={submitting}>
            {t('common.cancel')}
          </button>
          <button type="submit" style={BtnPrimary} disabled={submitting}>
            {submitting ? t('masterDashboard.modelos.invite.submitting') : t('masterDashboard.modelos.invite.submit')}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================
// Sub-componente: Modal Editar % pactado
// ============================================================
function EditShareModal({ open, model, onClose, onSaved }) {
  const [pct, setPct] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && model) {
      setPct(model.internalSharePctPactado != null ? String(model.internalSharePctPactado) : '');
      setNotes('');
      setError('');
    }
  }, [open, model]);

  const handleClose = () => onClose();

  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setError('');
    const n = Number(pct);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setError(t('masterDashboard.modelos.editShare.errors.pctRange'));
      return;
    }
    setSubmitting(true);
    try {
      await masterApi.setInternalShare(model.modelUserId, n, notes.trim() || null);
      onSaved();
      onClose();
    } catch (err) {
      setError(err?.data?.error || err?.message || t('masterDashboard.modelos.editShare.errors.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !model) return null;
  return (
    <div style={Overlay} onClick={handleClose}>
      <form style={Modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3 style={ModalTitle}>{t('masterDashboard.modelos.editShare.title')}</h3>
        <p style={{ fontSize: '0.88rem', color: '#6b7280', margin: 0 }}>
          {t('masterDashboard.modelos.editShare.subtitle', { nickname: model.nickname })}
        </p>

        <div style={Field}>
          <div style={Label}>{t('masterDashboard.modelos.editShare.pct')}</div>
          <input
            style={Input}
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            placeholder={t('masterDashboard.modelos.editShare.pctPlaceholder')}
            autoFocus
          />
        </div>

        <div style={Field}>
          <div style={Label}>{t('masterDashboard.modelos.editShare.notes')}</div>
          <input
            style={Input}
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('masterDashboard.modelos.editShare.notesPlaceholder')}
          />
        </div>

        {error && <div style={FormError}>{error}</div>}

        <div style={ModalActions}>
          <button type="button" style={BtnGhost} onClick={handleClose} disabled={submitting}>
            {t('common.cancel')}
          </button>
          <button type="submit" style={BtnPrimary} disabled={submitting}>
            {submitting ? t('masterDashboard.modelos.editShare.submitting') : t('masterDashboard.modelos.editShare.submit')}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================
// Componente principal
// ============================================================
export default function MasterModelosPanel() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [editingModel, setEditingModel] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await masterApi.listModels();
      setModels(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err?.data?.error || err?.message || t('masterDashboard.modelos.errors.load'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const showFlash = (text) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 4000);
  };

  const handleToggleActive = async (model) => {
    const next = !model.active;
    const confirmText = next
      ? t('masterDashboard.modelos.confirmActivate', { nickname: model.nickname })
      : t('masterDashboard.modelos.confirmDeactivate', { nickname: model.nickname });
    if (!window.confirm(confirmText)) return;
    try {
      await masterApi.setModelActive(model.modelUserId, next);
      showFlash(next
        ? t('masterDashboard.modelos.flash.activated', { nickname: model.nickname })
        : t('masterDashboard.modelos.flash.deactivated', { nickname: model.nickname }));
      load();
    } catch (err) {
      setError(err?.data?.error || err?.message || t('masterDashboard.modelos.errors.toggle'));
    }
  };

  return (
    <div style={Card}>
      <div style={Header}>
        <h2 style={H2}>{t('masterDashboard.modelos.title')}</h2>
        <button type="button" style={BtnPrimary} onClick={() => setShowInvite(true)}>
          + {t('masterDashboard.modelos.inviteButton')}
        </button>
      </div>

      {msg && <div style={OkBox} role="status">{msg}</div>}
      {error && <div style={ErrorBox} role="alert">{error}</div>}

      {loading && <div style={Empty}>{t('common.loading')}</div>}

      {!loading && models.length === 0 && (
        <div style={Empty}>
          <p style={{ margin: 0 }}>{t('masterDashboard.modelos.empty.title')}</p>
          <p style={{ margin: '8px 0 0', fontSize: '0.85rem' }}>{t('masterDashboard.modelos.empty.hint')}</p>
        </div>
      )}

      {!loading && models.length > 0 && (
        <div style={TableWrap}>
          <table style={Table}>
            <thead>
              <tr>
                <th style={Th}>{t('masterDashboard.modelos.cols.nickname')}</th>
                <th style={Th}>{t('masterDashboard.modelos.cols.status')}</th>
                <th style={Th}>{t('masterDashboard.modelos.cols.kyc')}</th>
                <th style={Th}>{t('masterDashboard.modelos.cols.hours')}</th>
                <th style={Th}>{t('masterDashboard.modelos.cols.rate')}</th>
                <th style={Th}>{t('masterDashboard.modelos.cols.share')}</th>
                <th style={{ ...Th, textAlign: 'right' }}>{t('masterDashboard.modelos.cols.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.modelUserId}>
                  <td style={Td}>{m.nickname || `#${m.modelUserId}`}</td>
                  <td style={Td}>{activeBadge(m.active)}</td>
                  <td style={Td}>{kycBadge(m.verificationStatus)}</td>
                  <td style={Td}>{fmtHours(m.streamingHours)}</td>
                  <td style={Td}>{fmtEur(m.chosenRateEurPerMin)}</td>
                  <td style={Td}>{fmtPct(m.internalSharePctPactado)}</td>
                  <td style={{ ...Td, textAlign: 'right' }}>
                    <button
                      type="button"
                      style={{ ...BtnSecondary, marginRight: 6 }}
                      onClick={() => setEditingModel(m)}
                    >
                      {t('masterDashboard.modelos.actions.editShare')}
                    </button>
                    <button
                      type="button"
                      style={m.active ? BtnDanger : BtnGhost}
                      onClick={() => handleToggleActive(m)}
                    >
                      {m.active
                        ? t('masterDashboard.modelos.actions.deactivate')
                        : t('masterDashboard.modelos.actions.activate')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <InviteModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        onInvited={() => {
          showFlash(t('masterDashboard.modelos.flash.invited'));
          load();
        }}
      />

      <EditShareModal
        open={!!editingModel}
        model={editingModel}
        onClose={() => setEditingModel(null)}
        onSaved={() => {
          showFlash(t('masterDashboard.modelos.flash.shareUpdated'));
          load();
        }}
      />
    </div>
  );
}
