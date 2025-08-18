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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const history = useHistory();

  const readErrorMessage = async (res) => {
    // Intenta leer JSON con { message }, si no hay, leer texto plano
    try {
      const data = await res.json();
      if (data && data.message) return data.message;
    } catch {
      // no JSON
    }
    try {
      const text = await res.text();
      if (text) return text;
    } catch {
      // sin cuerpo
    }
    // fallback según status
    if (res.status === 401) return 'Credenciales inválidas.';
    if (res.status === 403) return 'Acceso denegado.';
    if (res.status === 404) return 'Recurso no encontrado.';
    return `Error en el login: ${res.status} ${res.statusText}`;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

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

  return (
    <StyledContainer>
      <StyledForm onSubmit={handleLogin}>
        <h2>LOGIN SHAREMECHAT</h2>
        {error && <StyledError>{error}</StyledError>}

        <StyledInput
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          disabled={loading}
        />
        <StyledInput
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña (mínimo 8 caracteres)"
          required
          disabled={loading}
        />
        <StyledButton type="submit" disabled={loading}>
          {loading ? 'Entrando…' : 'Iniciar Sesión'}
        </StyledButton>

        <StyledLinkButton onClick={() => !loading && history.push('/register-client')}>
          ¿No tienes cuenta? Regístrate como Cliente
        </StyledLinkButton>
        <StyledLinkButton onClick={() => !loading && history.push('/register-model')}>
          Regístrate como Modelo
        </StyledLinkButton>
      </StyledForm>
    </StyledContainer>
  );
};

export default Login;
