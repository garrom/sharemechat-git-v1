// src/components/LoginModalContent.jsx
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import RegisterClientModalContent from './RegisterClientModalContent';
import RegisterModelModalContent from './RegisterModelModalContent';
import {
  StyledForm, StyledInput, StyledButton, StyledLinkButton,
  StyledError, Status, Field, FieldError, FormTitle,
  CloseBtn as LoginCloseBtn, TabsRow, TabButton
} from '../styles/public-styles/LoginStyles';

import Roles from '../constants/Roles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHouse, faXmark } from '@fortawesome/free-solid-svg-icons';

const LoginModalContent = ({ onClose }) => {
  // Vistas posibles:
  // - 'login'            → formulario de login
  // - 'register-gender'  → ¿eres chico o chica?
  // - 'register-client'  → formulario registro hombre (cliente)
  // - 'register-model'   → formulario registro mujer (modelo)
  const [view, setView] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const history = useHistory();

  const readErrorMessage = async (res) => {
    if (res.status === 401) return 'Credenciales inválidas.';
    if (res.status === 403) return 'Acceso denegado.';
    if (res.status === 404) return 'Servicio no disponible.';
    try {
      const data = await res.json();
      if (data?.message) return data.message;
    } catch {}
    return 'Error al iniciar sesión';
  };

  const validate = () => {
    const fe = { email: '', password: '' };
    if (!email.trim()) fe.email = 'Introduce tu email.';
    else if (!/^\S+@\S+\.\S+$/.test(email)) fe.email = 'Formato de email no válido.';
    if (!password) fe.password = 'Introduce tu contraseña.';
    else if (password.length < 8) fe.password = 'La contraseña debe tener al menos 8 caracteres.';
    setFieldErrors(fe);
    return !fe.email && !fe.password;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('');
    if (!validate()) return;
    setLoading(true);
    try {
      const response = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!response.ok) {
        const msg = await readErrorMessage(response);
        throw new Error(msg);
      }
      const data = await response.json();
      localStorage.setItem('token', data.token);
      setStatus('Acceso correcto. Redirigiendo…');
      if (data.user.role === Roles.CLIENT) {
        history.push('/client');
      } else if (data.user.role === Roles.MODEL) {
        history.push('/model');
      } else {
        history.push('/');
      }
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const isLoginTab = view === 'login';
  const isRegisterTab = view !== 'login';

  return (
    <StyledForm onSubmit={view === 'login' ? handleLogin : undefined} noValidate>
      {/* X de cierre */}
      {onClose && (
        <LoginCloseBtn type="button" onClick={onClose} aria-label="Cerrar" title="Cerrar">
          <FontAwesomeIcon icon={faXmark} />
        </LoginCloseBtn>
      )}

      {/* PESTAÑAS Login / Regístrate */}
      <TabsRow>
        <TabButton
          type="button"
          data-active={isLoginTab}
          onClick={() => setView('login')}
        >
          Login
        </TabButton>
        <TabButton
          type="button"
          data-active={isRegisterTab}
          onClick={() => setView('register-gender')}
        >
          Regístrate
        </TabButton>
      </TabsRow>

      {/* =============== VISTA LOGIN =============== */}
      {view === 'login' && (
        <>
          <FormTitle>Iniciar sesión</FormTitle>
          {status && <Status role="status">{status}</Status>}
          {error && <StyledError role="alert">{error}</StyledError>}

          <Field>
            <StyledInput
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors(f => ({ ...f, email: '' }));
              }}
              placeholder="Email"
              required
              disabled={loading}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              autoComplete="username"
            />
            {fieldErrors.email && <FieldError id="email-error">{fieldErrors.email}</FieldError>}
          </Field>

          <Field>
            <StyledInput
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors(f => ({ ...f, password: '' }));
              }}
              placeholder="Contraseña (mínimo 8 caracteres)"
              required
              disabled={loading}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              autoComplete="current-password"
            />
            {fieldErrors.password && <FieldError id="password-error">{fieldErrors.password}</FieldError>}
          </Field>

          <StyledButton type="submit" disabled={loading}>
            {loading ? 'Entrando…' : 'Iniciar Sesión'}
          </StyledButton>

          <StyledLinkButton type="button" onClick={() => history.push('/forgot-password')}>
            ¿Olvidaste tu contraseña?
          </StyledLinkButton>

        </>
      )}

      {/* =========== VISTA REGISTRO: ELECCIÓN GÉNERO =========== */}
      {view === 'register-gender' && (
        <>
          <FormTitle>¿Eres chico o chica?</FormTitle>

          <StyledButton type="button" onClick={() => setView('register-client')}>
            Soy Chico
          </StyledButton>

          <StyledButton type="button" onClick={() => setView('register-model')}>
            Soy Chica
          </StyledButton>

        </>
      )}

      {/* =========== VISTA REGISTRO HOMBRE (CLIENTE) =========== */}
      {view === 'register-client' && (
        <RegisterClientModalContent
          onClose={onClose}
          onBack={() => setView('register-gender')}
        />
      )}

      {/* =========== VISTA REGISTRO MUJER (MODELO) =========== */}
      {view === 'register-model' && (
        <RegisterModelModalContent
          onClose={onClose}
          onBack={() => setView('register-gender')}
        />
      )}
    </StyledForm>
  );
};

export default LoginModalContent;
