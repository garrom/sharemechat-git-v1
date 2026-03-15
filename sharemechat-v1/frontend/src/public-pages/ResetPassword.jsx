//ResetPassword.jsx
import React, { useMemo, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import i18n from '../i18n';
import {
  Container, Card, Title, Paragraph,
  StatusOk, StatusErr, Form, Input,
  ButtonPrimary, ButtonSecondary
} from '../styles/public-styles/ForgotResetPassStyles';

const ResetPassword = () => {
  const t = (key, options) => i18n.t(key, options);
  const history = useHistory();
  const location = useLocation();
  const token = useMemo(
    () => new URLSearchParams(location.search).get('token') || '',
    [location.search]
  );

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState({ loading: false, ok: '', err: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      setStatus({ loading: false, ok: '', err: t('auth.login.validation.passwordMin') });
      return;
    }
    if (password !== confirm) {
      setStatus({ loading: false, ok: '', err: t('auth.resetPasswordPage.validation.passwordMismatch') });
      return;
    }
    if (!token) {
      setStatus({ loading: false, ok: '', err: t('auth.resetPasswordPage.errors.tokenMissing') });
      return;
    }

    setStatus({ loading: true, ok: '', err: '' });
    try {
      const res = await fetch('/api/auth/password/reset', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });

      await res.text();
      if (!res.ok) {
        setStatus({ loading: false, ok: '', err: t('auth.resetPasswordPage.errors.submit') });
        return;
      }
      setStatus({ loading: false, ok: t('auth.resetPasswordPage.status.success'), err: '' });
    } catch {
      setStatus({ loading: false, ok: '', err: t('auth.resetPasswordPage.errors.connection') });
    }
  };

  return (
    <Container>
      <Card>
        <Title>{t('auth.resetPasswordPage.title')}</Title>
        <Paragraph>{t('auth.resetPasswordPage.subtitle')}</Paragraph>

        {!token && <StatusErr role="alert">{t('auth.resetPasswordPage.errors.tokenInvalid')}</StatusErr>}
        {status.ok && <StatusOk role="status">{status.ok}</StatusOk>}
        {status.err && <StatusErr role="alert">{status.err}</StatusErr>}

        <Form onSubmit={handleSubmit} noValidate>
          <Input
            type="password"
            placeholder={t('auth.resetPasswordPage.placeholders.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            aria-label={t('auth.resetPasswordPage.aria.password')}
          />
          <Input
            type="password"
            placeholder={t('auth.resetPasswordPage.placeholders.confirmPassword')}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            aria-label={t('auth.resetPasswordPage.aria.confirmPassword')}
          />
          <ButtonPrimary type="submit" disabled={status.loading || !token}>
            {status.loading ? t('auth.resetPasswordPage.actions.loading') : t('auth.resetPasswordPage.actions.submit')}
          </ButtonPrimary>
        </Form>

        <ButtonSecondary type="button" onClick={() => history.push('/')}>
          {t('auth.resetPasswordPage.actions.backHome')}
        </ButtonSecondary>
      </Card>
    </Container>
  );
};

export default ResetPassword;
