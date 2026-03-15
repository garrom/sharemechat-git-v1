//ForgotPassword.jsx
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import i18n from '../i18n';
import {
  Container, Card, Title, Paragraph,
  StatusOk, StatusErr, Form, Input,
  ButtonPrimary, ButtonSecondary
} from '../styles/public-styles/ForgotResetPassStyles';

const ForgotPassword = () => {
  const t = (key, options) => i18n.t(key, options);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState({ loading: false, ok: '', err: '' });
  const history = useHistory();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, ok: '', err: '' });
    try {
      const res = await fetch('/api/auth/password/forgot', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      // No filtramos existencia del email
      if (!res.ok) {
        // Podrías leer texto si quisieras, pero mantenemos respuesta homogénea
      }
      setStatus({
        loading: false,
        ok: t('auth.forgotPasswordPage.status.success'),
        err: '',
      });
    } catch {
      setStatus({ loading: false, ok: '', err: t('auth.forgotPasswordPage.status.connectionError') });
    }
  };


  return (
    <Container>
      <Card>
        <Title>{t('auth.forgotPasswordPage.title')}</Title>
        <Paragraph>{t('auth.forgotPasswordPage.subtitle')}</Paragraph>

        {status.ok && <StatusOk role="status">{status.ok}</StatusOk>}
        {status.err && <StatusErr role="alert">{status.err}</StatusErr>}

        <Form onSubmit={handleSubmit} noValidate>
          <Input
            type="email"
            placeholder={t('auth.login.placeholders.email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            aria-label={t('auth.login.placeholders.email')}
          />
          <ButtonPrimary type="submit" disabled={status.loading}>
            {status.loading ? t('auth.forgotPasswordPage.actions.loading') : t('auth.forgotPasswordPage.actions.submit')}
          </ButtonPrimary>
        </Form>

        <ButtonSecondary type="button" onClick={() => history.push('/')}>
          {t('common.back')}
        </ButtonSecondary>
      </Card>
    </Container>
  );
};

export default ForgotPassword;
