import React, { useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import i18n from '../../i18n';
import { apiFetch } from '../../config/http';
import { useModal } from '../../components/ModalProvider';
import { useSession } from '../../components/SessionProvider';
import { canAccessBackoffice } from '../../utils/backofficeAccess';
import { buildAdminAppUrl, navigateToUrl } from '../../utils/runtimeSurface';
import { isEmailNotVerifiedError } from '../../utils/apiErrors';

const fieldStyle = {
  display: 'grid',
  gap: 6,
};

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid #cfd8e6',
  background: '#fff',
  color: '#162033',
  fontSize: 14,
  outline: 'none',
};

const buttonStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: 'none',
  background: '#16324f',
  color: '#fff',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
};

const AdminLoginForm = () => {
  const history = useHistory();
  const { openModal, closeModal, alert } = useModal();
  const { refresh } = useSession();
  const t = (key, options) => i18n.t(key, options);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const modalOpenRef = useRef(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError(t('admin.auth.validation.requiredFields'));
      return;
    }

    setLoading(true);

    try {
      await apiFetch('/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const refreshedUser = await refresh();

      if (refreshedUser && canAccessBackoffice(refreshedUser)) {
        navigateToUrl(buildAdminAppUrl('/dashboard-admin'), history);
      } else {
        setError(t('admin.auth.errors.sessionValidation'));
      }
    } catch (err) {
      const statusCode = Number(err?.status);

      if (isEmailNotVerifiedError(err)) {
        setError(t('admin.auth.errors.emailNotVerified'));

        if (!modalOpenRef.current) {
          modalOpenRef.current = true;

          openModal({
            title: t('admin.auth.modal.emailNotVerified.title'),
            variant: 'warning',
            size: 'sm',
            onClose: () => closeModal(),
            content: t('admin.auth.modal.emailNotVerified.body'),
            actions: [
              {
                label: t('admin.auth.modal.emailNotVerified.actions.later'),
                onClick: () => closeModal(false),
              },
              {
                label: t('admin.auth.modal.emailNotVerified.actions.resend'),
                primary: true,
                onClick: async () => {
                  try {
                    await apiFetch('/email-verification/resend', { method: 'POST' });
                    closeModal(true);
                    await alert({
                      title: t('admin.auth.resend.successTitle'),
                      message: t('admin.auth.resend.successMessage'),
                      variant: 'success',
                      size: 'sm',
                    });
                  } catch {
                    closeModal(false);
                    await alert({
                      title: t('admin.auth.resend.errorTitle'),
                      message: t('admin.auth.resend.errorMessage'),
                      variant: 'warning',
                      size: 'sm',
                    });
                  }
                },
              },
            ],
          }).finally(() => {
            modalOpenRef.current = false;
          });
        }
      } else if (statusCode === 401) {
        setError(t('admin.auth.errors.invalidCredentials'));
      } else if (statusCode === 403) {
        setError(t('admin.auth.errors.accessDenied'));
      } else {
        setError(t('admin.auth.errors.generic'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: 14, padding: 22, borderRadius: 16, border: '1px solid #d9e2f2', background: '#fff', boxShadow: '0 12px 30px rgba(15, 24, 38, 0.08)' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#16324f' }}>{t('admin.auth.form.title')}</div>
      <div style={{ fontSize: 13, color: '#5f6b7a', lineHeight: 1.55 }}>
        {t('admin.auth.form.subtitle')}
      </div>

      {error ? (
        <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #f1c4bf', background: '#fff1f0', color: '#b42318', fontSize: 13, lineHeight: 1.45 }}>
          {error}
        </div>
      ) : null}

      <label style={fieldStyle}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#52607a' }}>{t('admin.auth.fields.email')}</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          disabled={loading}
          style={inputStyle}
        />
      </label>

      <label style={fieldStyle}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#52607a' }}>{t('admin.auth.fields.password')}</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          disabled={loading}
          style={inputStyle}
        />
      </label>

      <button type="submit" disabled={loading} style={{ ...buttonStyle, opacity: loading ? 0.7 : 1 }}>
        {loading ? t('admin.auth.actions.loading') : t('admin.auth.actions.submit')}
      </button>
    </form>
  );
};

export default AdminLoginForm;
