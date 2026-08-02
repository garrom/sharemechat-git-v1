// MasterPayoutPanel.jsx — ADR-056 Fases S5.a.8.b + S6.a.
// Grid superior 2 cols (saldo + solicitud de retiro) + card inferior
// full-width "Métodos de cobro" (CRUD autoservicio, S6.a).
//
// El channel del formulario de retiro sigue siendo string libre hasta
// S6.b — la sección de métodos abajo es sólo libreta de direcciones
// por ahora; en S6.b el formulario dejará de aceptar channel string y
// pasará a seleccionar payout_method_id.
import React, { useCallback, useEffect, useState } from 'react';
import i18n from '../../i18n';
import masterApi from '../../api/masterApi';

// ============================================================
// Estilos compartidos
// ============================================================
const Card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px' };
const Header = { marginBottom: 12 };
const HeaderRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 12 };
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
const BtnSecondary = {
  padding: '7px 14px', borderRadius: 6, border: '1px solid #d1d5db',
  background: '#fff', color: '#374151', cursor: 'pointer',
  fontSize: '0.85rem', fontWeight: 600,
};
const BtnLink = {
  background: 'transparent', border: 'none', color: '#7c3aed',
  cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: 0,
};
const BtnDangerLink = { ...BtnLink, color: '#dc2626' };

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

const TableWrap = { overflowX: 'auto' };
const Table = { width: '100%', borderCollapse: 'collapse', minWidth: 640 };
const Th = { textAlign: 'left', padding: '10px 12px', fontWeight: 600, color: '#374151', background: '#f3f4f6', fontSize: '0.82rem', borderBottom: '1px solid #e5e7eb', textTransform: 'uppercase', letterSpacing: '0.03em' };
const Td = { padding: '10px 12px', color: '#111827', fontSize: '0.92rem', borderBottom: '1px solid #f3f4f6' };
const Empty = { padding: '32px 20px', textAlign: 'center', color: '#6b7280', fontSize: '0.95rem' };

const ModalBackdrop = {
  position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: 20,
};
const Modal = {
  background: '#fff', borderRadius: 12, padding: '24px',
  maxWidth: 480, width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
};

const BadgePill = (variant) => {
  const map = {
    default: { bg: '#e0e7ff', fg: '#3730a3' },
    verified: { bg: '#dcfce7', fg: '#166534' },
    unverified: { bg: '#fef3c7', fg: '#92400e' },
  };
  const c = map[variant] || map.default;
  return {
    display: 'inline-block', padding: '3px 10px', borderRadius: 999,
    fontSize: '0.72rem', fontWeight: 600, background: c.bg, color: c.fg,
    marginLeft: 6,
  };
};

// ============================================================
// Constantes
// ============================================================
const MIN_PAYOUT = 100;
const MAX_PAYOUT = 1000;

// El channel del formulario de retiro (S5.a) sigue como string libre
// hasta el refactor de S6.b. Cuando se cambie a payout_method_id,
// este array desaparece.
const CHANNELS = [
  { key: 'PAXUM', i18n: 'paxum' },
  { key: 'YOURSAFE', i18n: 'yoursafe' },
  { key: 'NOWPAYMENTS_CRYPTO', i18n: 'crypto' },
  { key: 'SEPA_MANUAL', i18n: 'sepa' },
];

// Rails de la sección "Métodos de cobro" (S6.a). Alineados con
// PayoutMethodService.validateSemantic backend.
const RAILS = [
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

const railLabel = (rail) => {
  const r = RAILS.find(x => x.key === rail);
  return r ? t(`masterDashboard.payout.form.channel.options.${r.i18n}`) : rail;
};

// ============================================================
// Componente principal
// ============================================================
export default function MasterPayoutPanel() {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [amount, setAmount] = useState('');
  // S6.b (2026-08-02): el string libre 'channel' se retira. El
  // formulario ahora exige seleccionar uno de los payoutMethods del
  // user (los que gestiona en la sección de abajo). Fallback vacío
  // cuando aún no hay métodos.
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitOk, setSubmitOk] = useState(null);

  // === Métodos de cobro (S6.a) ===
  const [methods, setMethods] = useState([]);
  const [methodsLoading, setMethodsLoading] = useState(true);
  const [methodsError, setMethodsError] = useState('');
  const [editing, setEditing] = useState(null); // null | {} nuevo | {id, ...} edición
  const [savingMethod, setSavingMethod] = useState(false);
  const [methodFormError, setMethodFormError] = useState('');

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

  const loadMethods = useCallback(async () => {
    setMethodsLoading(true);
    setMethodsError('');
    try {
      const list = await masterApi.listPayoutMethods();
      setMethods(Array.isArray(list) ? list : []);
    } catch (err) {
      setMethodsError(err?.data?.error || err?.message || t('masterDashboard.payout.methods.errors.load'));
    } finally {
      setMethodsLoading(false);
    }
  }, []);

  useEffect(() => { loadBalance(); }, [loadBalance]);
  useEffect(() => { loadMethods(); }, [loadMethods]);

  // Autoseleccionar el método default (o el primero) cuando cargan.
  // Si el user borra el método seleccionado o el default cambia, se
  // recalcula. Solo actúa si no hay ya uno elegido para no pisar la
  // interacción del user.
  useEffect(() => {
    if (!methods.length) {
      setSelectedMethodId('');
      return;
    }
    if (!selectedMethodId || !methods.find((m) => String(m.id) === String(selectedMethodId))) {
      const def = methods.find((m) => m.default) || methods[0];
      setSelectedMethodId(String(def.id));
    }
  }, [methods, selectedMethodId]);

  const amountNum = Number(amount);
  const amountRangeOk = Number.isInteger(amountNum)
    && amountNum >= MIN_PAYOUT
    && amountNum <= MAX_PAYOUT
    && balance != null
    && amountNum <= Number(balance);
  const methodOk = !!selectedMethodId;
  const canSubmit = amountRangeOk && methodOk;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    setSubmitOk(null);
    try {
      const res = await masterApi.requestPayout({
        amount: amountNum,
        payoutMethodId: Number(selectedMethodId),
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

  // === Handlers métodos de cobro ===
  const openNewMethod = () => {
    setMethodFormError('');
    setEditing({ rail: 'PAXUM', accountRef: '', displayAlias: '', setAsDefault: false });
  };
  const openEditMethod = (m) => {
    setMethodFormError('');
    setEditing({ id: m.id, rail: m.rail, accountRef: m.accountRef, displayAlias: m.displayAlias || '', setAsDefault: m.default });
  };
  const closeMethodModal = () => {
    setEditing(null);
    setMethodFormError('');
  };

  const handleSaveMethod = async (e) => {
    e.preventDefault();
    if (savingMethod || !editing) return;
    setSavingMethod(true);
    setMethodFormError('');
    try {
      const body = {
        rail: editing.rail,
        accountRef: editing.accountRef.trim(),
        displayAlias: editing.displayAlias ? editing.displayAlias.trim() : null,
        setAsDefault: !!editing.setAsDefault,
      };
      if (editing.id) {
        await masterApi.updatePayoutMethod(editing.id, body);
      } else {
        await masterApi.createPayoutMethod(body);
      }
      await loadMethods();
      closeMethodModal();
    } catch (err) {
      setMethodFormError(err?.data?.error || err?.message || t('masterDashboard.payout.methods.errors.save'));
    } finally {
      setSavingMethod(false);
    }
  };

  const handleSetDefault = async (id) => {
    try {
      await masterApi.setDefaultPayoutMethod(id);
      loadMethods();
    } catch (err) {
      setMethodsError(err?.data?.error || err?.message || t('masterDashboard.payout.methods.errors.setDefault'));
    }
  };

  const handleDeleteMethod = async (m) => {
    const label = m.displayAlias || m.accountRef;
    // eslint-disable-next-line no-restricted-globals
    if (!window.confirm(t('masterDashboard.payout.methods.confirmDelete', { label }))) return;
    try {
      await masterApi.deletePayoutMethod(m.id);
      loadMethods();
    } catch (err) {
      setMethodsError(err?.data?.error || err?.message || t('masterDashboard.payout.methods.errors.delete'));
    }
  };

  return (
    <div>
      <style>{`
        .mp-payout-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 20px;
          align-items: start;
          margin-bottom: 20px;
        }
        @media (min-width: 1024px) {
          .mp-payout-grid {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          }
        }
        .mp-input::placeholder {
          color: #9ca3af;
          opacity: 1;
        }
      `}</style>

      <div className="mp-payout-grid">
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
                step="1"
                min={MIN_PAYOUT}
                max={MAX_PAYOUT}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={t('masterDashboard.payout.form.amount.placeholder')}
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
              <label htmlFor="payout-method" style={Label}>
                {t('masterDashboard.payout.form.method.label')}
              </label>
              {methods.length === 0 ? (
                <div style={{ ...HelpText, padding: '8px 12px', background: '#fef3c7', color: '#92400e', borderRadius: 6, border: '1px solid #fcd34d' }}>
                  {t('masterDashboard.payout.form.method.emptyNotice')}
                </div>
              ) : (
                <select
                  id="payout-method"
                  value={selectedMethodId}
                  onChange={(e) => setSelectedMethodId(e.target.value)}
                  style={Select}
                  disabled={submitting}
                  required
                >
                  {methods.map((m) => (
                    <option key={m.id} value={m.id}>
                      {(m.displayAlias || railLabel(m.rail))} — {m.accountRef}
                      {m.default ? ` · ${t('masterDashboard.payout.methods.badges.default')}` : ''}
                    </option>
                  ))}
                </select>
              )}
              <span style={HelpText}>
                {t('masterDashboard.payout.form.method.help')}
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
              style={BtnPrimary(!canSubmit || submitting)}
              disabled={!canSubmit || submitting}
            >
              {submitting ? t('masterDashboard.payout.form.submitting') : t('masterDashboard.payout.form.submit')}
            </button>
          </form>
        </div>
      </div>

      {/* Sección S6.a — Métodos de cobro */}
      <div style={Card}>
        <div style={HeaderRow}>
          <div>
            <h2 style={H2}>{t('masterDashboard.payout.methods.title')}</h2>
            <div style={Subtitle}>{t('masterDashboard.payout.methods.subtitle')}</div>
          </div>
          <button type="button" style={BtnPrimary(false)} onClick={openNewMethod}>
            {t('masterDashboard.payout.methods.actions.add')}
          </button>
        </div>

        {methodsError && <div style={AlertBox('error')} role="alert">{methodsError}</div>}

        {methodsLoading && <div style={Empty}>{t('common.loading')}</div>}

        {!methodsLoading && methods.length === 0 && (
          <div style={Empty}>
            <p style={{ margin: 0 }}>{t('masterDashboard.payout.methods.empty.title')}</p>
            <p style={{ margin: '6px 0 0', fontSize: '0.85rem' }}>{t('masterDashboard.payout.methods.empty.hint')}</p>
          </div>
        )}

        {!methodsLoading && methods.length > 0 && (
          <div style={TableWrap}>
            <table style={Table}>
              <thead>
                <tr>
                  <th style={Th}>{t('masterDashboard.payout.methods.cols.rail')}</th>
                  <th style={Th}>{t('masterDashboard.payout.methods.cols.accountRef')}</th>
                  <th style={Th}>{t('masterDashboard.payout.methods.cols.alias')}</th>
                  <th style={Th}>{t('masterDashboard.payout.methods.cols.status')}</th>
                  <th style={Th}>{t('masterDashboard.payout.methods.cols.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {methods.map((m) => (
                  <tr key={m.id}>
                    <td style={Td}>{railLabel(m.rail)}</td>
                    <td style={{ ...Td, fontFamily: 'monospace', fontSize: '0.85rem' }}>{m.accountRef}</td>
                    <td style={Td}>{m.displayAlias || '—'}</td>
                    <td style={Td}>
                      {m.default && <span style={BadgePill('default')}>{t('masterDashboard.payout.methods.badges.default')}</span>}
                      {m.verifiedAt
                        ? <span style={BadgePill('verified')}>{t('masterDashboard.payout.methods.badges.verified')}</span>
                        : <span style={BadgePill('unverified')}>{t('masterDashboard.payout.methods.badges.unverified')}</span>}
                    </td>
                    <td style={Td}>
                      <div style={{ display: 'flex', gap: 12 }}>
                        {!m.default && (
                          <button type="button" style={BtnLink} onClick={() => handleSetDefault(m.id)}>
                            {t('masterDashboard.payout.methods.actions.setDefault')}
                          </button>
                        )}
                        <button type="button" style={BtnLink} onClick={() => openEditMethod(m)}>
                          {t('masterDashboard.payout.methods.actions.edit')}
                        </button>
                        <button type="button" style={BtnDangerLink} onClick={() => handleDeleteMethod(m)}>
                          {t('masterDashboard.payout.methods.actions.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal crear/editar método */}
      {editing && (
        <div style={ModalBackdrop} onClick={closeMethodModal}>
          <div style={Modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>
              {editing.id
                ? t('masterDashboard.payout.methods.modal.editTitle')
                : t('masterDashboard.payout.methods.modal.newTitle')}
            </h3>

            {methodFormError && <div style={AlertBox('error')} role="alert">{methodFormError}</div>}

            <form onSubmit={handleSaveMethod}>
              <div style={FieldBlock}>
                <label style={Label}>{t('masterDashboard.payout.methods.form.rail')}</label>
                <select
                  value={editing.rail}
                  onChange={(e) => setEditing({ ...editing, rail: e.target.value })}
                  style={Select}
                  disabled={savingMethod}
                >
                  {RAILS.map((r) => (
                    <option key={r.key} value={r.key}>
                      {t(`masterDashboard.payout.form.channel.options.${r.i18n}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={FieldBlock}>
                <label style={Label}>
                  {t(`masterDashboard.payout.methods.form.accountRefLabel.${editing.rail}`)}
                </label>
                <input
                  type="text"
                  value={editing.accountRef}
                  onChange={(e) => setEditing({ ...editing, accountRef: e.target.value })}
                  placeholder={t(`masterDashboard.payout.methods.form.accountRefPlaceholder.${editing.rail}`)}
                  className="mp-input"
                  style={Input}
                  disabled={savingMethod}
                  required
                />
                <span style={HelpText}>
                  {t(`masterDashboard.payout.methods.form.accountRefHelp.${editing.rail}`)}
                </span>
              </div>

              <div style={FieldBlock}>
                <label style={Label}>{t('masterDashboard.payout.methods.form.alias')}</label>
                <input
                  type="text"
                  value={editing.displayAlias}
                  onChange={(e) => setEditing({ ...editing, displayAlias: e.target.value })}
                  placeholder={t('masterDashboard.payout.methods.form.aliasPlaceholder')}
                  className="mp-input"
                  style={Input}
                  maxLength={80}
                  disabled={savingMethod}
                />
              </div>

              <div style={{ ...FieldBlock, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input
                  id="method-setDefault"
                  type="checkbox"
                  checked={!!editing.setAsDefault}
                  onChange={(e) => setEditing({ ...editing, setAsDefault: e.target.checked })}
                  disabled={savingMethod}
                />
                <label htmlFor="method-setDefault" style={{ ...Label, cursor: 'pointer' }}>
                  {t('masterDashboard.payout.methods.form.setDefault')}
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" style={BtnSecondary} onClick={closeMethodModal} disabled={savingMethod}>
                  {t('common.cancel')}
                </button>
                <button type="submit" style={BtnPrimary(savingMethod)} disabled={savingMethod}>
                  {savingMethod ? t('masterDashboard.payout.methods.form.saving') : t('masterDashboard.payout.methods.form.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
