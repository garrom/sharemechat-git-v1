import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  StyledContainer,
  StyledForm,
  StyledInput,
  StyledButton,
  StyledLinkButton,
  StyledError,
} from '../styles/RegisterClientStyles';

const RegisterClient = () => {
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isOver18, setIsOver18] = useState(false);
  const [acceptsTerms, setAcceptsTerms] = useState(false);
  const [error, setError] = useState('');
  const history = useHistory();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    const nick = nickname.trim();
    if (!nick) {
      setError('El apodo (nickname) es obligatorio.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (!isOver18) {
      setError('Debes confirmar que eres mayor de 18 años.');
      return;
    }
    if (!acceptsTerms) {
      setError('Debes aceptar los términos y condiciones.');
      return;
    }

    // OJO: el backend espera confirAdult y acceptedTerm
    const registerData = {
      nickname: nick,
      email,
      password,
      confirAdult: isOver18,
      acceptedTerm: acceptsTerms,
    };

    try {
      const response = await fetch('/api/users/register/client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerData),
      });

      if (!response.ok) {
        let errorMessage = `Error en el registro: ${response.status} ${response.statusText}`;
        try {
          const responseText = await response.text();
          try {
            const err = JSON.parse(responseText);
            errorMessage = err.message || err.error || responseText || errorMessage;
          } catch {
            errorMessage = responseText || errorMessage;
          }
        } catch {
          // ignore
        }
        throw new Error(errorMessage);
      }

      alert('Registro exitoso');
      history.push('/');
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <StyledContainer>
      <StyledForm onSubmit={handleRegister}>
        <h2>Registro como Cliente</h2>
        {error && <StyledError>{error}</StyledError>}

        <StyledInput
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Apodo / Nickname"
          required
        />

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

        {/* --- Checkboxes legales --- */}
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
          <input
            type="checkbox"
            checked={isOver18}
            onChange={(e) => setIsOver18(e.target.checked)}
            required
          />
          <span>Soy mayor de 18 años</span>
        </label>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
          <input
            type="checkbox"
            checked={acceptsTerms}
            onChange={(e) => setAcceptsTerms(e.target.checked)}
            required
          />
          <span>
            Acepto los{' '}
            <a href="/terms" target="_blank" rel="noreferrer">
              Términos y Condiciones
            </a>{' '}
            y la{' '}
            <a href="/privacy" target="_blank" rel="noreferrer">
              Política de Privacidad
            </a>
          </span>
        </label>
        {/* --- fin checkboxes --- */}

        <StyledButton type="submit">Registrarse</StyledButton>

        <StyledLinkButton onClick={() => history.push('/register-model')}>
          ¿Quieres ser modelo?
        </StyledLinkButton>
        <StyledLinkButton onClick={() => history.push('/')}>
          Volver al Login
        </StyledLinkButton>
      </StyledForm>
    </StyledContainer>
  );
};

export default RegisterClient;
