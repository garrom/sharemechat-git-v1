//ResetPassword.jsx
import React, { useMemo, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import {
  Container, Card, Title, Paragraph,
  StatusOk, StatusErr, Form, Input,
  ButtonPrimary, ButtonSecondary
} from '../styles/public-styles/ForgotResetPassStyles';

const ResetPassword = () => {
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
      setStatus({ loading: false, ok: '', err: 'La contraseña debe tener al menos 8 caracteres.' });
      return;
    }
    if (password !== confirm) {
      setStatus({ loading: false, ok: '', err: 'Las contraseñas no coinciden.' });
      return;
    }
    if (!token) {
      setStatus({ loading: false, ok: '', err: 'Token no encontrado en el enlace.' });
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

      const text = await res.text();
      if (!res.ok) {
        setStatus({ loading: false, ok: '', err: text || 'No se pudo restablecer la contraseña.' });
        return;
      }
      setStatus({ loading: false, ok: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.', err: '' });
    } catch {
      setStatus({ loading: false, ok: '', err: 'Error de conexión. Inténtalo de nuevo.' });
    }
  };

  return (
    <Container>
      <Card>
        <Title>Establecer nueva contraseña</Title>

        {!token && <StatusErr role="alert">Token ausente o inválido.</StatusErr>}
        {status.ok && <StatusOk role="status">{status.ok}</StatusOk>}
        {status.err && <StatusErr role="alert">{status.err}</StatusErr>}

        <Form onSubmit={handleSubmit} noValidate>
          <Input
            type="password"
            placeholder="Nueva contraseña (mín. 8)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            aria-label="Nueva contraseña"
          />
          <Input
            type="password"
            placeholder="Repite la nueva contraseña"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            aria-label="Confirmar nueva contraseña"
          />
          <ButtonPrimary type="submit" disabled={status.loading || !token}>
            {status.loading ? 'Actualizando…' : 'Guardar nueva contraseña'}
          </ButtonPrimary>
        </Form>

        <ButtonSecondary type="button" onClick={() => history.push('/')}>
          Volver al inicio
        </ButtonSecondary>
      </Card>
    </Container>
  );
};

export default ResetPassword;
