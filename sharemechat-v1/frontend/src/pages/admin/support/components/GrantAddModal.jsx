import React, { useState } from 'react';
import i18n from '../../../../i18n';
import { apiFetch } from '../../../../config/http';
import SupportModal from './SupportModal';
import SupportButton from './SupportButton';

// Frente B.3.2 (ADR-046). Otorgar grant N:N sobre una profile. Admite userId
// numerico. No hay endpoint publico para busqueda por email en el alcance de
// B.3.2, asi que el operador introduce el id. Un endpoint de busqueda por
// email queda como deuda si el volumen lo justifica (fuera de scope).

const inputStyle = {
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  fontSize: '0.88rem',
  width: '100%',
  boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.78rem',
  color: '#475569',
  fontWeight: 600,
  marginBottom: 4,
  marginTop: 10,
};

const GrantAddModal = ({ profileId, onClose, onGranted }) => {
  const t = (key, opts) => i18n.t(key, opts);
  const [userId, setUserId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    const parsed = parseInt(String(userId || '').trim(), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setErr(t('admin.support.grants.form.errorIdInvalid'));
      return;
    }
    setSubmitting(true);
    setErr('');
    try {
      const grant = await apiFetch(`/admin/support/profiles/${profileId}/grants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: parsed }),
      });
      if (typeof onGranted === 'function') onGranted(grant);
    } catch (e) {
      setErr(e?.message || 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SupportModal
      title={t('admin.support.grants.add.title')}
      subtitle={t('admin.support.grants.add.subtitle')}
      width={460}
      onClose={onClose}
      actions={(
        <>
          <SupportButton variant="secondary" onClick={onClose} disabled={submitting}>
            {t('admin.support.grants.form.cancel')}
          </SupportButton>
          <SupportButton variant="primary" onClick={submit} disabled={submitting}>
            {submitting
              ? t('admin.support.grants.form.submitting')
              : t('admin.support.grants.add.confirm')}
          </SupportButton>
        </>
      )}
    >
      <label style={labelStyle}>{t('admin.support.grants.form.userIdLabel')}</label>
      <input
        type="number"
        min="1"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        placeholder={t('admin.support.grants.form.userIdPlaceholder')}
        style={inputStyle}
        autoFocus
      />
      {err ? (
        <div style={{ color: '#b91c1c', fontSize: '0.82rem', marginTop: 8 }}>{err}</div>
      ) : null}
    </SupportModal>
  );
};

export default GrantAddModal;
