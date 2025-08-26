import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  StyledContainer,
  StyledForm,
  StyledInput,
  StyledButton,
  StyledLinkButton,
  StyledError,
} from '../styles/LoginStyles';
import Roles from '../constants/Roles';
import UserTypes from '../constants/UserTypes';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');        // <- errores generales (backend/red)
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' }); // <- validación de usuario
  const [status, setStatus] = useState('');      // <- mensajes informativos (no error)
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
    // Email simple
    if (!email.trim()) fe.email = 'Introduce tu email.';
    else if (!/^\S+@\S+\.\S+$/.test(email)) fe.email = 'Formato de email no válido.';
    // Password
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
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const msg = await readErrorMessage(response);
        throw new Error(msg);
      }

      const data = await response.json();
      localStorage.setItem('token', data.token);
      setStatus('Acceso correcto. Redirigiendo…');

      // Routing según rol y userType
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
          setError('Tipo de usuario no válido'); // <- esto sí es general
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

  return (
    <StyledContainer>
      <StyledForm onSubmit={handleLogin}>
        <h2>LOGIN SHAREMECHAT</h2>

        {/* Mensajes generales */}
        {status && <div style={{ color: '#6c757d', marginBottom: 8 }}>{status}</div>}
        {error && <StyledError>{error}</StyledError>}

        {/* Email */}
        <div style={{ marginBottom: 8 }}>
          <StyledInput
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors(f => ({...f, email: ''})); }}
            placeholder="Email"
            required
            disabled={loading}
            aria-invalid={!!fieldErrors.email}
            aria-describedby="email-error"
          />
          {fieldErrors.email && (
            <div id="email-error" style={{ color: '#dc3545', fontSize: 12, marginTop: 4 }}>
              {fieldErrors.email}
            </div>
          )}
        </div>

        {/* Password */}
        <div style={{ marginBottom: 8 }}>
          <StyledInput
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors(f => ({...f, password: ''})); }}
            placeholder="Contraseña (mínimo 8 caracteres)"
            required
            disabled={loading}
            aria-invalid={!!fieldErrors.password}
            aria-describedby="password-error"
          />
          {fieldErrors.password && (
            <div id="password-error" style={{ color: '#dc3545', fontSize: 12, marginTop: 4 }}>
              {fieldErrors.password}
            </div>
          )}
        </div>

        <StyledButton type="submit" disabled={loading}>
          {loading ? 'Entrando…' : 'Iniciar Sesión'}
        </StyledButton>

        <StyledLinkButton onClick={() => !loading && history.push('/register-client')}>
          Regístrate como Cliente
        </StyledLinkButton>
        <StyledLinkButton onClick={() => !loading && history.push('/register-model')}>
          Regístrate como Modelo
        </StyledLinkButton>
        <StyledLinkButton onClick={() => !loading && history.push('/forgot-password')}>
          ¿Olvidaste tu contraseña?
        </StyledLinkButton>
      </StyledForm>
    </StyledContainer>
  );
};

export default Login;
