import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import RegisterClientModalContent from './RegisterClientModalContent';
import RegisterModelModalContent from './RegisterModelModalContent';
import { useSession } from '../components/SessionProvider';
import {
  StyledForm, StyledInput, StyledButton, StyledLinkButton,
  StyledError, Status, Field, FieldError, FormTitle,
  CloseBtn as LoginCloseBtn, TabsRow, TabButton
} from '../styles/public-styles/LoginStyles';

import Roles from '../constants/Roles';
import UserTypes from '../constants/UserTypes';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';

const LoginModalContent = ({ onClose, onLoginSuccess }) => {
  // vistas: login | register-gender | register-client | register-model
  const [view, setView] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const history = useHistory();
  const { refresh, user } = useSession();

  const safeNavigate = (path) => {
    if (history && typeof history.push === 'function') {
      history.push(path);
    } else {
      window.location.href = path;
    }
  };

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
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const msg = await readErrorMessage(response);
        throw new Error(msg);
      }

      setStatus('Acceso correcto. Redirigiendo…');

      const u = await refresh();

      if (u?.role === Roles.ADMIN) {
        safeNavigate('/dashboard-admin');
      } else if (u?.role === Roles.CLIENT) {
        safeNavigate('/client');
      } else if (u?.role === Roles.MODEL) {
        safeNavigate('/model');
      } else if (u?.role === Roles.USER) {
        if (u?.userType === UserTypes.FORM_CLIENT) safeNavigate('/dashboard-user-client');
        else if (u?.userType === UserTypes.FORM_MODEL) safeNavigate('/dashboard-user-model');
        else setError('Tipo de usuario no válido');
      } else {
        // Si aún no está resuelto el user, manda a Home/Login y RequireRole hará su trabajo al re-render
        safeNavigate('/');
      }
      if (onLoginSuccess) onLoginSuccess();
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
      {onClose && (
        <LoginCloseBtn type="button" onClick={onClose} aria-label="Cerrar" title="Cerrar">
          <FontAwesomeIcon icon={faXmark} />
        </LoginCloseBtn>
      )}

      <TabsRow>
        <TabButton type="button" data-active={isLoginTab} onClick={() => setView('login')}>Login</TabButton>
        <TabButton type="button" data-active={isRegisterTab} onClick={() => setView('register-gender')}>Regístrate</TabButton>
      </TabsRow>

      {/* LOGIN */}
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

          <StyledLinkButton type="button" onClick={() => safeNavigate('/forgot-password')}>
            ¿Olvidaste tu contraseña?
          </StyledLinkButton>
        </>
      )}

      {/* REGISTRO: ELECCIÓN GÉNERO */}
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

      {/* REGISTRO HOMBRE */}
      {view === 'register-client' && (
        <RegisterClientModalContent
          onClose={onClose}
          onBack={() => setView('register-gender')}
        />
      )}

      {/* REGISTRO MUJER */}
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
