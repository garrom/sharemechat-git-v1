import React, { useState } from 'react';
import i18n from '../../../../i18n';
import { apiFetch } from '../../../../config/http';
import SupportModal from './SupportModal';
import SupportButton from './SupportButton';

// Frente B.3.2 (ADR-046). Crear identidad de servicio (profile). display_name
// required unique global; category opcional texto libre con placeholder.

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

const ProfileCreateModal = ({ onClose, onCreated }) => {
  const t = (key, opts) => i18n.t(key, opts);
  const [displayName, setDisplayName] = useState('');
  const [category, setCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    const clean = String(displayName || '').trim();
    if (!clean) {
      setErr(t('admin.support.profiles.form.errorNameRequired'));
      return;
    }
    setSubmitting(true);
    setErr('');
    try {
      const created = await apiFetch('/admin/support/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: clean,
          category: category ? String(category).trim() : null,
        }),
      });
      if (typeof onCreated === 'function') onCreated(created);
    } catch (e) {
      setErr(e?.message || 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SupportModal
      title={t('admin.support.profiles.create.title')}
      subtitle={t('admin.support.profiles.create.subtitle')}
      width={520}
      onClose={onClose}
      actions={(
        <>
          <SupportButton variant="secondary" onClick={onClose} disabled={submitting}>
            {t('admin.support.profiles.form.cancel')}
          </SupportButton>
          <SupportButton variant="primary" onClick={submit} disabled={submitting}>
            {submitting
              ? t('admin.support.profiles.form.submitting')
              : t('admin.support.profiles.create.confirm')}
          </SupportButton>
        </>
      )}
    >
      <div>
        <label style={labelStyle}>{t('admin.support.profiles.form.displayNameLabel')}</label>
        <input
          type="text"
          maxLength={80}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={t('admin.support.profiles.form.displayNamePlaceholder')}
          style={inputStyle}
          autoFocus
        />
        <label style={labelStyle}>{t('admin.support.profiles.form.categoryLabel')}</label>
        <input
          type="text"
          maxLength={40}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder={t('admin.support.profiles.form.categoryPlaceholder')}
          style={inputStyle}
        />
        {err ? (
          <div style={{ color: '#b91c1c', fontSize: '0.82rem', marginTop: 8 }}>{err}</div>
        ) : null}
      </div>
    </SupportModal>
  );
};

export default ProfileCreateModal;
