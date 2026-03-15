//ChangePasswordPage.jsx
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import i18n from '../../i18n';
import { apiFetch } from '../../config/http';

const NavbarLite = ({ onBack, t }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 16px', borderBottom: '1px solid #eee', position: 'sticky', top: 0, background: '#fff', zIndex: 10
  }}>
    <a
      href="/"
      aria-label="SharemeChat"
      style={{
        display: 'inline-block',
        width: 180,
        height: 36,
        backgroundImage: "url('/img/SharemeChat_2.svg')",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'left center',
        backgroundSize: 'contain'
      }}
    />

    <button onClick={onBack} style={{ padding: '8px 12px', cursor: 'pointer' }}>
      {t('common.back')}
    </button>
  </div>
);

const checkStrength = (pwd) => {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
};

const strengthLabel = (s) => {
  if (s <= 1) return i18n.t('auth.changePasswordPage.strength.veryWeak');
  if (s === 2) return i18n.t('auth.changePasswordPage.strength.weak');
  if (s === 3) return i18n.t('auth.changePasswordPage.strength.medium');
  if (s === 4) return i18n.t('auth.changePasswordPage.strength.strong');
  return i18n.t('auth.changePasswordPage.strength.veryStrong');
};

const ChangePasswordPage = () => {
  const t = (key, options) => i18n.t(key, options);
  const history = useHistory();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const strength = checkStrength(newPassword);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setOkMsg('');

    if (!currentPassword || !newPassword || !repeatPassword) {
      setError(t('auth.changePasswordPage.errors.completeFields'));
      return;
    }
    if (newPassword !== repeatPassword) {
      setError(t('auth.changePasswordPage.errors.passwordMismatch'));
      return;
    }
    if (newPassword.length < 8) {
      setError(t('auth.login.validation.passwordMin'));
      return;
    }

    try {
      setSubmitting(true);
      await apiFetch('/users/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      setOkMsg(t('auth.changePasswordPage.success.updated'));
      setCurrentPassword('');
      setNewPassword('');
      setRepeatPassword('');
      setTimeout(() => history.goBack(), 1500);
    } catch (err) {
      setError(t('auth.changePasswordPage.errors.submit'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      <NavbarLite onBack={() => history.goBack()} t={t} />

      <div style={{ maxWidth: 520, margin: '24px auto', padding: '0 16px' }}>
        <h2 style={{ marginBottom: 8 }}>{t('auth.changePasswordPage.title')}</h2>
        <p style={{ color: '#6c757d', marginTop: 0 }}>
          {t('auth.changePasswordPage.subtitle')}
        </p>

        <form onSubmit={handleSubmit} style={{
          background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: 16
        }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 6 }}>{t('auth.changePasswordPage.labels.currentPassword')}</label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder={t('auth.changePasswordPage.placeholders.currentPassword')}
              autoComplete="current-password"
              style={{ width: '100%', padding: 10, border: '1px solid #ccc', borderRadius: 8 }}
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', marginBottom: 6 }}>{t('auth.changePasswordPage.labels.newPassword')}</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder={t('auth.changePasswordPage.placeholders.newPassword')}
              autoComplete="new-password"
              style={{ width: '100%', padding: 10, border: '1px solid #ccc', borderRadius: 8 }}
            />
            <div style={{ marginTop: 6, fontSize: 12, color: '#6c757d' }}>
              {t('auth.changePasswordPage.hints.passwordStrength')}
            </div>

            <div style={{ marginTop: 8 }}>
              <div style={{ height: 8, background: '#eee', borderRadius: 999 }}>
                <div
                  style={{
                    height: 8,
                    width: `${(strength / 5) * 100}%`,
                    background: strength >= 4 ? '#28a745' : strength === 3 ? '#ffc107' : '#dc3545',
                    borderRadius: 999,
                    transition: 'width .2s ease'
                  }}
                />
              </div>
              <div style={{ fontSize: 12, marginTop: 6 }}>
                {t('auth.changePasswordPage.strength.label')}: <strong>{strengthLabel(strength)}</strong>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 6 }}>{t('auth.changePasswordPage.labels.repeatPassword')}</label>
            <input
              type="password"
              value={repeatPassword}
              onChange={e => setRepeatPassword(e.target.value)}
              placeholder={t('auth.changePasswordPage.placeholders.repeatPassword')}
              autoComplete="new-password"
              style={{ width: '100%', padding: 10, border: '1px solid #ccc', borderRadius: 8 }}
            />
          </div>

          {error && <p style={{ color: 'red', marginTop: 4 }}>{error}</p>}
          {okMsg && <p style={{ color: 'green', marginTop: 4 }}>{okMsg}</p>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
            <button
              type="button"
              onClick={() => history.goBack()}
              style={{ padding: '10px 14px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{ padding: '10px 14px', background: '#007bff', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
            >
              {submitting ? t('auth.changePasswordPage.actions.loading') : t('auth.changePasswordPage.actions.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
