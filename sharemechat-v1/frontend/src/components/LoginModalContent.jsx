// src/components/LoginModalContent.jsx
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
    StyledForm, StyledInput, StyledButton, StyledLinkButton, StyledError, Status, Field, FieldError, FormTitle,
    CloseBtn as LoginCloseBtn
} from '../styles/public-styles/LoginStyles';
import Roles from '../constants/Roles';
import UserTypes from '../constants/UserTypes';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHouse,faXmark  } from '@fortawesome/free-solid-svg-icons';

/**
 * Card de login reutilizable:
 * - No pinta fondo ni navbar, solo el formulario.
 * - Puede usarse dentro de un modal o en una página.
 *
 * Props:
 * - onClose?: () => void   -> se usará cuando está dentro de un modal (cerrar al ir a Inicio/registro).
 */
const LoginModalContent = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const history = useHistory();

  const readErrorMessage = async (res) => {
    try { const data = await res.json(); if (data?.message) return data.message; } catch {}
    try { const text = await res.text(); if (text) return text; } catch {}
    if (res.status === 401) return 'Credenciales inválidas.';
    if (res.status === 403) return 'Acceso denegado.';
    if (res.status === 404) return 'Recurso no encontrado.';
    return `Error en el login: ${res.status} ${res.statusText}`;
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
      const response = await fetch('/api/users/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      if (!response.ok) {
        const msg = await readErrorMessage(response);
        throw new Error(msg);
      }
      const data = await response.json();
      localStorage.setItem('token', data.token);
      setStatus('Acceso correcto. Redirigiendo…');

      // Si quieres, puedes llamar onClose() antes de la navegación, pero no es estrictamente necesario
      // porque al cambiar de ruta el modal se desmonta.
      if (data.user.role === Roles.ADMIN) {
        history.push('/dashboard-admin');
      } else if (data.user.role === Roles.CLIENT) {
        history.push('/client');
      } else if (data.user.role === Roles.MODEL) {
        history.push('/model');
      } else if (data.user.role === Roles.USER) {
        if (data.user.userType === UserTypes.FORM_CLIENT) {
          history.push('/dashboard-user-client');
        } else if (data.user.userType === UserTypes.FORM_MODEL) {
          history.push('/dashboard-user-model');
        } else {
          setError('Tipo de usuario no válido');
        }
      } else {
        setError('Rol de usuario no válido');
      }
    } catch (err) {
      setError(err.message || 'Error de red');
    } finally {
      setLoading(false);
    }
  };

  const goHome = () => {
    if (loading) return;
    if (onClose) onClose();  // cerrar modal si aplica
    history.push('/');
  };

  const goForgotPassword = () => {
    if (loading) return;
    if (onClose) onClose();
    history.push('/forgot-password');
  };

  const goRegisterClient = () => {
    if (loading) return;
    if (onClose) onClose();
    history.push('/register-client');
  };

  const goRegisterModel = () => {
    if (loading) return;
    if (onClose) onClose();
    history.push('/register-model');
  };

  return (
    <StyledForm onSubmit={handleLogin} noValidate>
      {onClose && (
        <LoginCloseBtn type="button" onClick={onClose} aria-label="Cerrar" title="Cerrar">
          <FontAwesomeIcon icon={faXmark} />
        </LoginCloseBtn>
      )}

      <FormTitle>LOGIN</FormTitle>
      {status && <Status role="status">{status}</Status>}
      {error && <StyledError role="alert">{error}</StyledError>}

      <Field>
        <StyledInput
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: '' })); }}
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
          onChange={(e) => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: '' })); }}
          placeholder="Contraseña (mínimo 8 caracteres)"
          required
          disabled={loading}
          aria-invalid={!!fieldErrors.password}
          aria-describedby={fieldErrors.password ? 'password-error' : undefined}
          autoComplete="current-password"
        />
        {fieldErrors.password && <FieldError id="password-error">{fieldErrors.password}</FieldError>}
      </Field>

      <StyledButton type="submit" disabled={loading}>{loading ? 'Entrando…' : 'Iniciar Sesión'}</StyledButton>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <StyledLinkButton type="button" onClick={goHome} aria-label="Volver a inicio">
            <FontAwesomeIcon icon={faHouse} style={{ marginRight: 8 }} />
            Inicio
          </StyledLinkButton>
          <StyledLinkButton type="button" onClick={goForgotPassword}>¿Olvidaste tu contraseña?</StyledLinkButton>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <StyledLinkButton type="button" onClick={goRegisterClient}>Regístro de Cliente</StyledLinkButton>
          <StyledLinkButton type="button" onClick={goRegisterModel}>Regístro de Modelo</StyledLinkButton>
        </div>
      </div>
    </StyledForm>
  );
};

export default LoginModalContent;
