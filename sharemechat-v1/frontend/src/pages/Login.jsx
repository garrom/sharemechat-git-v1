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
  const history = useHistory();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    const loginData = { email, password };

    try {
      const response = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Error en el login: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      localStorage.setItem('token', data.token);

      if (data.user.role === Roles.ADMIN) {
        history.push('/dashboard-admin');
      } else if (data.user.role === Roles.CLIENT) {
        history.push('/client');
      } else if (data.user.role === Roles.MODEL) {
        history.push('/model');
      } else if (data.user.role === Roles.USER) {
        // <-- usar userType (singular), no userTypes
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
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <StyledContainer>
      <StyledForm onSubmit={handleLogin}>
        <h2>LOGIN SHARECHATME</h2>
        {error && <StyledError>{error}</StyledError>}
        <StyledInput
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
        />
        <StyledInput
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña (mínimo 8 caracteres)"
          required
        />
        <StyledButton type="submit">Iniciar Sesión</StyledButton>
        <StyledLinkButton onClick={() => history.push('/register-client')}>
          ¿No tienes cuenta? Regístrate como Cliente
        </StyledLinkButton>
        <StyledLinkButton onClick={() => history.push('/register-model')}>
          Regístrate como Modelo
        </StyledLinkButton>
      </StyledForm>
    </StyledContainer>
  );
};

export default Login;