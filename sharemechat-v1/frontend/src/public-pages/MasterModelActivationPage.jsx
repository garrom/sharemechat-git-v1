// MasterModelActivationPage.jsx
// ADR-056 Fase S5.b (S5.b.4): pagina publica de activacion para modelos
// invitadas por un Master. Consume POST /api/masters/models/activate/{token}
// tras leer el token de path param. La modelo genera su propia password:
// nadie (incluido el Master) la conoce.
import React, { useEffect, useMemo, useState } from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import i18n from '../i18n';
import {
  Container, Card, Title, Paragraph,
  StatusOk, StatusErr, Form, Input,
  ButtonPrimary, ButtonSecondary,
} from '../styles/public-styles/ForgotResetPassStyles';

const MasterModelActivationPage = () => {
  const t = (key, options) => i18n.t(key, options);
  const history = useHistory();
  const location = useLocation();
  const params = useParams();

  // Preferimos path param /master/invite/activate/:token; caemos a ?token= como fallback.
  const token = useMemo(() => {
    if (params && params.token) return params.token;
    const q = new URLSearchParams(location.search).get('token');
    return q || '';
  }, [params, location.search]);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState({ loading: false, ok: '', err: '' });
  const [studioName, setStudioName] = useState('');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/masters/models/invitation-info/${encodeURIComponent(token)}`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.masterDisplayName) setStudioName(data.masterDisplayName);
      } catch { /* silent: sin nombre, fallback en copy */ }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: false, ok: '', err: '' });

    if (password.length < 10) {
      setStatus({ loading: false, ok: '', err: t('auth.masterActivation.validation.passwordMin') });
      return;
    }
    if (/\s/.test(password)) {
      setStatus({ loading: false, ok: '', err: t('auth.masterActivation.validation.passwordNoSpaces') });
      return;
    }
    if (password !== confirm) {
      setStatus({ loading: false, ok: '', err: t('auth.masterActivation.validation.passwordMismatch') });
      return;
    }
    if (!token) {
      setStatus({ loading: false, ok: '', err: t('auth.masterActivation.status.tokenMissing') });
      return;
    }

    setStatus({ loading: true, ok: '', err: '' });
    try {
      const res = await fetch(`/api/masters/models/activate/${encodeURIComponent(token)}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      let payload = null;
      try { payload = await res.json(); } catch { payload = null; }

      if (!res.ok) {
        const msg = payload?.error || t('auth.masterActivation.status.tokenInvalid');
        setStatus({ loading: false, ok: '', err: msg });
        return;
      }
      setStatus({ loading: false, ok: t('auth.masterActivation.status.success'), err: '' });
    } catch {
      setStatus({ loading: false, ok: '', err: t('auth.masterActivation.errors.connection') });
    }
  };

  return (
    <Container>
      <Card>
        <Title style={{ color: '#7c3aed' }}>{t('auth.masterActivation.title')}</Title>
        <Paragraph style={{ fontWeight: 600, fontSize: '1.05rem' }}>
          {t('auth.masterActivation.greeting')}
        </Paragraph>
        <Paragraph>
          {t('auth.masterActivation.intro', { studioName: studioName || t('auth.masterActivation.studioFallback') })}
        </Paragraph>
        <Paragraph>{t('auth.masterActivation.callToAction')}</Paragraph>

        {!token && <StatusErr role="alert">{t('auth.masterActivation.status.tokenMissing')}</StatusErr>}
        {status.ok && <StatusOk role="status">{status.ok}</StatusOk>}
        {status.err && <StatusErr role="alert">{status.err}</StatusErr>}

        <Form onSubmit={handleSubmit} noValidate>
          <Input
            type="password"
            placeholder={t('auth.masterActivation.placeholders.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={10}
            autoComplete="new-password"
            aria-label={t('auth.masterActivation.labels.password')}
            disabled={status.loading || !!status.ok || !token}
          />
          <Input
            type="password"
            placeholder={t('auth.masterActivation.placeholders.confirmPassword')}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={10}
            autoComplete="new-password"
            aria-label={t('auth.masterActivation.labels.confirmPassword')}
            disabled={status.loading || !!status.ok || !token}
          />
          <ButtonPrimary type="submit" disabled={status.loading || !!status.ok || !token}>
            {status.loading ? t('auth.masterActivation.actions.loading') : t('auth.masterActivation.actions.submit')}
          </ButtonPrimary>
        </Form>

        <ButtonSecondary type="button" onClick={() => history.push('/login')}>
          {t('auth.masterActivation.actions.goLogin')}
        </ButtonSecondary>
      </Card>
    </Container>
  );
};

export default MasterModelActivationPage;
