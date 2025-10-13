import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';

import {
  Container,
  Form,
  Title,
  Input,
  Button,
  LinkButton,
  Error as ErrorText,
  Field,
  FieldError,
  CheckRow,
  CheckInput,
  CheckText,
  StyledBrand
} from '../styles/RegisterClientModelStyles';

const RegisterModel = () => {
  const [nickname, setNickname] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [isOver18, setIsOver18] = useState(false);
  const [acceptsTerms, setAcceptsTerms] = useState(false);
  const [error, setError]       = useState('');
  const [fieldErrors, setFieldErrors] = useState({ nickname: '', email: '', password: '', dateOfBirth: '' });
  const history = useHistory();

  const validate = () => {
    const fe = { nickname: '', email: '', password: '', dateOfBirth: '' };
    if (!nickname.trim()) fe.nickname = 'El apodo (nickname) es obligatorio.';
    if (!email.trim()) fe.email = 'El email es obligatorio.';
    else if (!/^\S+@\S+\.\S+$/.test(email)) fe.email = 'Formato de email no válido.';
    if (password.length < 8) fe.password = 'La contraseña debe tener al menos 8 caracteres';
    if (!dateOfBirth) fe.dateOfBirth = 'La fecha de nacimiento es obligatoria.';
    setFieldErrors(fe);
    return !fe.nickname && !fe.email && !fe.password && !fe.dateOfBirth;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!validate()) return;
    if (!isOver18)   return setError('Debes confirmar que eres mayor de 18 años.');
    if (!acceptsTerms) return setError('Debes aceptar los términos y condiciones.');

    const registerData = {
      nickname: nickname.trim(),
      email,
      password,
      dateOfBirth,              // YYYY-MM-DD
      confirAdult: isOver18,
      acceptedTerm: acceptsTerms,
    };

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
            const err = JSON.parse(responseText);
            errorMessage = err.message || err.error || responseText || errorMessage;
          } catch {
            errorMessage = responseText || errorMessage;
          }
        } catch {}
        throw new Error(errorMessage);
      }

      alert('Registro exitoso');
      history.push('/');
    } catch (err) {
      setError(err.message || 'Error de red');
      console.error('Error en el registro:', err);
    }
  };

  return (
    <Container>
      <Form onSubmit={handleRegister} noValidate>
        <StyledBrand href="/" aria-label="SharemeChat"/>
        <Title>Registro Modelo</Title>
        {error && <ErrorText role="alert">{error}</ErrorText>}

        <Field>
          <Input
            type="text"
            value={nickname}
            onChange={(e) => { setNickname(e.target.value); if (fieldErrors.nickname) setFieldErrors(f => ({...f, nickname: ''})); }}
            placeholder="Apodo / Nickname"
            required
            aria-invalid={!!fieldErrors.nickname}
            aria-describedby={fieldErrors.nickname ? 'nick-error' : undefined}
            autoComplete="nickname"
          />
          {fieldErrors.nickname && <FieldError id="nick-error">{fieldErrors.nickname}</FieldError>}
        </Field>

        <Field>
          <Input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors(f => ({...f, email: ''})); }}
            placeholder="Email"
            required
            aria-invalid={!!fieldErrors.email}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            autoComplete="email"
          />
          {fieldErrors.email && <FieldError id="email-error">{fieldErrors.email}</FieldError>}
        </Field>

        <Field>
          <Input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors(f => ({...f, password: ''})); }}
            placeholder="Contraseña (mínimo 8 caracteres)"
            required
            aria-invalid={!!fieldErrors.password}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            autoComplete="new-password"
          />
          {fieldErrors.password && <FieldError id="password-error">{fieldErrors.password}</FieldError>}
        </Field>

        <Field>
          <Input
            type="date"
            value={dateOfBirth}
            onChange={(e) => { setDateOfBirth(e.target.value); if (fieldErrors.dateOfBirth) setFieldErrors(f => ({...f, dateOfBirth: ''})); }}
            placeholder="Fecha de Nacimiento"
            required
            aria-invalid={!!fieldErrors.dateOfBirth}
            aria-describedby={fieldErrors.dateOfBirth ? 'dob-error' : undefined}
            autoComplete="bday"
          />
          {fieldErrors.dateOfBirth && <FieldError id="dob-error">{fieldErrors.dateOfBirth}</FieldError>}
        </Field>

        {/* Checkboxes legales */}
        <CheckRow>
          <CheckInput
            type="checkbox"
            checked={isOver18}
            onChange={(e) => setIsOver18(e.target.checked)}
            required
          />
          <CheckText>Soy mayor de 18 años</CheckText>
        </CheckRow>

        <CheckRow>
          <CheckInput
            type="checkbox"
            checked={acceptsTerms}
            onChange={(e) => setAcceptsTerms(e.target.checked)}
            required
          />
          <CheckText>
            Acepto los <a href="/terms" target="_blank" rel="noreferrer">Términos y Condiciones</a> y la{' '}
            <a href="/privacy" target="_blank" rel="noreferrer">Política de Privacidad</a>
          </CheckText>
        </CheckRow>

        <Button type="submit">Registrarse</Button>
        <LinkButton type="button" onClick={() => history.push('/login')}>
          Volver al Login
        </LinkButton>
      </Form>
    </Container>
  );
};

export default RegisterModel;
