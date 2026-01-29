//ForgotPassword.jsx
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  Container, Card, Title, Paragraph,
  StatusOk, StatusErr, Form, Input,
  ButtonPrimary, ButtonSecondary
} from '../styles/public-styles/ForgotResetPassStyles';

const ForgotPassword = () => {
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
        ok: 'Si el email existe, te hemos enviado un enlace para restablecer tu contraseña.',
        err: '',
      });
    } catch {
      setStatus({ loading: false, ok: '', err: 'Error de conexión. Inténtalo de nuevo.' });
    }
  };


  return (
    <Container>
      <Card>
        <Title>Recuperar contraseña</Title>
        <Paragraph>Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.</Paragraph>

        {status.ok && <StatusOk role="status">{status.ok}</StatusOk>}
        {status.err && <StatusErr role="alert">{status.err}</StatusErr>}

        <Form onSubmit={handleSubmit} noValidate>
          <Input
            type="email"
            placeholder="Tu email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            aria-label="Email"
          />
          <ButtonPrimary type="submit" disabled={status.loading}>
            {status.loading ? 'Enviando…' : 'Enviar enlace'}
          </ButtonPrimary>
        </Form>

        <ButtonSecondary type="button" onClick={() => history.push('/')}>
          Volver
        </ButtonSecondary>
      </Card>
    </Container>
  );
};

export default ForgotPassword;
