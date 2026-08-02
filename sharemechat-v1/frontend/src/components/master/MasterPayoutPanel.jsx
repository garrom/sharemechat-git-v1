// MasterPayoutPanel.jsx — ADR-056 Fase S5.a.8.b.
// Formulario de solicitud de retiro (payout) del Master autenticado.
// Consume masterApi.requestPayout (POST /api/masters/me/payout).
// El channel es ORIENTATIVO — hasta que S6 integre adapters multi-rail,
// el backend guarda el channel como referencia comercial en `description`
// y el flujo real se resuelve manualmente por admin.
import React, { useCallback, useEffect, useState } from 'react';
import i18n from '../../i18n';
import masterApi from '../../api/masterApi';

// ============================================================
// Estilos (patrón MasterHistorialPanel / MasterModelosPanel)
// ============================================================
const Wrap = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 20, alignItems: 'start' };
const Card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px' };
const Header = { marginBottom: 12 };
const H2 = { margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#111827' };
const Subtitle = { fontSize: '0.85rem', color: '#6b7280', marginTop: 4 };

const KpiLabel = { fontSize: '0.78rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' };
const KpiValue = { fontSize: '1.8rem', fontWeight: 700, color: '#0f172a', margin: '6px 0 4px' };
const KpiHint = { fontSize: '0.82rem', color: '#6b7280', lineHeight: 1.5 };

const FieldBlock = { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 };
const Label = { fontSize: '0.85rem', color: '#374151', fontWeight: 600 };
const Input = {
  padding: '9px 12px', borderRadius: 6, border: '1px solid #d1d5db',
  fontSize: '0.95rem', color: '#111827', background: '#fff',
};
const Select = { ...Input, cursor: 'pointer' };
const Textarea = { ...Input, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' };
const HelpText = { fontSize: '0.78rem', color: '#6b7280' };

const BtnPrimary = (disabled) => ({
  padding: '10px 20px', borderRadius: 6, border: 'none',
  background: disabled ? '#94a3b8' : '#7c3aed', color: '#fff',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: '0.95rem', fontWeight: 600,
});

const AlertBox = (variant) => {
  const map = {
    error: { bg: '#fee2e2', fg: '#991b1b', border: '#fca5a5' },
    success: { bg: '#dcfce7', fg: '#166534', border: '#86efac' },
    info: { bg: '#e0e7ff', fg: '#3730a3', border: '#a5b4fc' },
  };
  const c = map[variant] || map.info;
  return {
    padding: '12px 16px', background: c.bg, color: c.fg,
    border: `1px solid ${c.border}`, borderRadius: 8,
    marginBottom: 14, fontSize: '0.9rem',
  };
};

// ============================================================
// Constantes (alineadas con MasterPayoutService)
// ============================================================
const MIN_PAYOUT = 100;
const MAX_PAYOUT = 1000;

const CHANNELS = [
  { key: 'PAXUM', i18n: 'paxum' },
  { key: 'YOURSAFE', i18n: 'yoursafe' },
  { key: 'NOWPAYMENTS_CRYPTO', i18n: 'crypto' },
  { key: 'SEPA_MANUAL', i18n: 'sepa' },
];

// ============================================================
// Helpers
// ============================================================
const t = (k, opts) => i18n.t(k, opts);

const fmtEur = (n) => {
  if (n == null) return '—';
  try {
    return new Intl.NumberFormat(i18n.language || 'es', {
      style: 'currency', currency: 'EUR', maximumFractionDigits: 2,
    }).format(Number(n));
  } catch { return `${Number(n).toFixed(2)} €`; }
};

// ============================================================
// Componente
// ============================================================
export default function MasterPayoutPanel() {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [amount, setAmount] = useState('');
  const [channel, setChannel] = useState('PAXUM');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitOk, setSubmitOk] = useState(null); // { id, amount }

  const loadBalance = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const me = await masterApi.getMe();
      setBalance(me?.balance ?? me?.balanceCurrent ?? 0);
    } catch (err) {
      setError(err?.data?.error || err?.message || t('masterDashboard.payout.errors.loadBalance'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBalance(); }, [loadBalance]);

  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum)
    && amountNum >= MIN_PAYOUT
    && amountNum <= MAX_PAYOUT
    && balance != null
    && amountNum <= Number(balance);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amountValid || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    setSubmitOk(null);
    try {
      const res = await masterApi.requestPayout({
        amount: amountNum,
        channel,
        description: description || null,
      });
      setSubmitOk({ id: res?.payoutRequestId ?? res?.id, amount: amountNum });
      setAmount('');
      setDescription('');
      loadBalance();
    } catch (err) {
      setSubmitError(err?.data?.error || err?.data?.message || err?.message || t('masterDashboard.payout.errors.submit'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismissOk = () => setSubmitOk(null);

  return (
    <div className="mp-payout-grid">
      <style>{`
        .mp-payout-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 20px;
          align-items: start;
        }
        @media (min-width: 1024px) {
          .mp-payout-grid {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          }
        }
        /* Color de placeholder consistente (gris claro pero legible).
           Los defaults del user-agent varían por navegador; explicitar
           evita que un placeholder "100" parezca un valor real. */
        .mp-input::placeholder {
          color: #9ca3af;
          opacity: 1;
        }
      `}</style>

      <div style={Card}>
        <div style={Header}>
          <h2 style={H2}>{t('masterDashboard.payout.balance.title')}</h2>
          <div style={Subtitle}>{t('masterDashboard.payout.balance.subtitle')}</div>
        </div>

        {error && <div style={AlertBox('error')} role="alert">{error}</div>}

        <div style={{ marginTop: 16 }}>
          <div style={KpiLabel}>{t('masterDashboard.payout.balance.available')}</div>
          <div style={KpiValue}>{loading ? '—' : fmtEur(balance)}</div>
          <div style={KpiHint}>
            {t('masterDashboard.payout.balance.hint', {
              min: fmtEur(MIN_PAYOUT),
              max: fmtEur(MAX_PAYOUT),
            })}
          </div>
        </div>
      </div>

      <div style={Card}>
        <div style={Header}>
          <h2 style={H2}>{t('masterDashboard.payout.form.title')}</h2>
          <div style={Subtitle}>{t('masterDashboard.payout.form.subtitle')}</div>
        </div>

        {submitOk && (
          <div style={AlertBox('success')} role="status">
            {t('masterDashboard.payout.form.successBody', {
              amount: fmtEur(submitOk.amount),
              id: submitOk.id != null ? `#${submitOk.id}` : '',
            })}
            <button
              type="button"
              onClick={handleDismissOk}
              style={{ marginLeft: 10, background: 'transparent', border: 'none', color: '#166534', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
            >
              {t('common.dismiss')}
            </button>
          </div>
        )}

        {submitError && <div style={AlertBox('error')} role="alert">{submitError}</div>}

        <form onSubmit={handleSubmit}>
          <div style={FieldBlock}>
            <label htmlFor="payout-amount" style={Label}>
              {t('masterDashboard.payout.form.amount.label')}
            </label>
            <input
              id="payout-amount"
              type="number"
              step="0.01"
              min={MIN_PAYOUT}
              max={MAX_PAYOUT}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t('masterDashboard.payout.form.amount.placeholder', { min: MIN_PAYOUT })}
              className="mp-input"
              style={Input}
              disabled={submitting || loading}
              required
            />
            <span style={HelpText}>
              {t('masterDashboard.payout.form.amount.help', {
                min: fmtEur(MIN_PAYOUT),
                max: fmtEur(MAX_PAYOUT),
              })}
            </span>
          </div>

          <div style={FieldBlock}>
            <label htmlFor="payout-channel" style={Label}>
              {t('masterDashboard.payout.form.channel.label')}
            </label>
            <select
              id="payout-channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              style={Select}
              disabled={submitting}
            >
              {CHANNELS.map((c) => (
                <option key={c.key} value={c.key}>
                  {t(`masterDashboard.payout.form.channel.options.${c.i18n}`)}
                </option>
              ))}
            </select>
            <span style={HelpText}>
              {t('masterDashboard.payout.form.channel.help')}
            </span>
          </div>

          <div style={FieldBlock}>
            <label htmlFor="payout-description" style={Label}>
              {t('masterDashboard.payout.form.description.label')}
            </label>
            <textarea
              id="payout-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('masterDashboard.payout.form.description.placeholder')}
              maxLength={500}
              className="mp-input"
              style={Textarea}
              disabled={submitting}
            />
            <span style={HelpText}>
              {t('masterDashboard.payout.form.description.help', { chars: description.length })}
            </span>
          </div>

          <button
            type="submit"
            style={BtnPrimary(!amountValid || submitting)}
            disabled={!amountValid || submitting}
          >
            {submitting ? t('masterDashboard.payout.form.submitting') : t('masterDashboard.payout.form.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
