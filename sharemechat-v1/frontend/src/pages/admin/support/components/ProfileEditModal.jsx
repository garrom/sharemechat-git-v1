import React, { useState } from 'react';
import i18n from '../../../../i18n';
import { apiFetch } from '../../../../config/http';
import SupportModal from './SupportModal';
import SupportButton from './SupportButton';

// Frente B.3.2 (ADR-046). Editar profile: displayName, category, active.

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

const ProfileEditModal = ({ profile, onClose, onUpdated }) => {
  const t = (key, opts) => i18n.t(key, opts);
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [category, setCategory] = useState(profile?.category || '');
  const [active, setActive] = useState(!!profile?.active);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!profile?.id) return;
    const cleanName = String(displayName || '').trim();
    if (!cleanName) {
      setErr(t('admin.support.profiles.form.errorNameRequired'));
      return;
    }
    setSubmitting(true);
    setErr('');
    try {
      const updated = await apiFetch(`/admin/support/profiles/${profile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: cleanName,
          category: category ? String(category).trim() : null,
          active,
        }),
      });
      if (typeof onUpdated === 'function') onUpdated(updated);
    } catch (e) {
      setErr(e?.message || 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SupportModal
      title={t('admin.support.profiles.edit.title')}
      subtitle={t('admin.support.profiles.edit.subtitle')}
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
              : t('admin.support.profiles.edit.confirm')}
          </SupportButton>
        </>
      )}
    >
      <label style={labelStyle}>{t('admin.support.profiles.form.displayNameLabel')}</label>
      <input
        type="text"
        maxLength={80}
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
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
      <label style={{ ...labelStyle, marginTop: 12 }}>
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          style={{ marginRight: 6, verticalAlign: 'middle' }}
        />
        {t('admin.support.profiles.form.activeLabel')}
      </label>
      {err ? (
        <div style={{ color: '#b91c1c', fontSize: '0.82rem', marginTop: 8 }}>{err}</div>
      ) : null}
    </SupportModal>
  );
};

export default ProfileEditModal;
