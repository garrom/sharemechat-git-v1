import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  StyledContainer,
  StyledForm,
  StyledInput,
  StyledButton,
  StyledLinkButton,
  StyledError,
} from '../styles/RegisterModelStyles';

const RegisterModel = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [error, setError] = useState('');
  const history = useHistory();

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    const registerData = { email, password, dateOfBirth };

    try {
      const response = await fetch('/api/users/register/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerData),
      });

      if (!response.ok) {
        let errorMessage = `Error en el registro: ${response.status} ${response.statusText}`;
        try {
          const responseText = await response.text();
          try {
            const error = JSON.parse(responseText);
            errorMessage = error.message || error.error || responseText || errorMessage;
          } catch (jsonError) {
            errorMessage = responseText || errorMessage;
          }
        } catch (e) {
          errorMessage = `Error ${response.status}: ${response.statusText}`;
        }
        console.error('Detalles del error:', errorMessage);
        throw new Error(errorMessage);
      }

      alert('Registro exitoso');
      history.push('/');
    } catch (error) {
      setError(error.message);
      console.error('Error en el registro:', error);
    }
  };

  return (
    <StyledContainer>
      <StyledForm onSubmit={handleRegister}>
        <h2>Registro como Modelo</h2>
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
        <StyledInput
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          placeholder="Fecha de Nacimiento"
          required
        />
        <StyledButton type="submit">Registrarse</StyledButton>
        <StyledLinkButton onClick={() => history.push('/')}>
          Volver al Login
        </StyledLinkButton>
      </StyledForm>
    </StyledContainer>
  );
};

export default RegisterModel;