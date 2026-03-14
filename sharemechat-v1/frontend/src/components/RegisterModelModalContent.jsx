import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import i18n from '../i18n';
import { getResolvedLocale } from '../i18n/localeUtils';
import { Form as RegForm, Title, Input, Button, LinkButton, Error as ErrorText, Field, FieldError, CheckRow, CheckInput, CheckText } from '../styles/public-styles/RegisterClientModelStyles';
import { useAppModals } from './useAppModals';

const InlineForm = styled(RegForm)`
  background: transparent;
  border: 0;
  box-shadow: none;
  margin: 0;
  padding: 0;
`;

const RegisterModelModalContent = ({ onClose, onBack }) => {

  const { alert } = useAppModals();
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [isOver18, setIsOver18] = useState(false);
  const [acceptsTerms, setAcceptsTerms] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ nickname: '', email: '', password: '', dateOfBirth: '' });
  const [loading, setLoading] = useState(false);


  const validate = () => {
    const fe = { nickname: '', email: '', password: '', dateOfBirth: '' };
    if (!nickname.trim()) fe.nickname = i18n.t('auth.registerModel.validation.nicknameRequired');
    if (!email.trim()) fe.email = i18n.t('auth.registerModel.validation.emailRequired');
    else if (!/^\S+@\S+\.\S+$/.test(email)) fe.email = i18n.t('auth.registerModel.validation.emailInvalid');
    if (password.length < 8) fe.password = i18n.t('auth.registerModel.validation.passwordMin');
    if (!dateOfBirth) fe.dateOfBirth = i18n.t('auth.registerModel.validation.dateOfBirthRequired');
    setFieldErrors(fe);
    return !fe.nickname && !fe.email && !fe.password && !fe.dateOfBirth;
  };

  const handleRegister = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (loading) return;
    setError('');
    if (!validate()) return;
    if (!isOver18) return setError(i18n.t('auth.registerModel.validation.confirmAdult'));
    if (!acceptsTerms) return setError(i18n.t('auth.registerModel.validation.acceptTerms'));

    const uiLocale = getResolvedLocale(i18n);

    const registerData = {
      nickname: nickname.trim(),
      email,
      password,
      dateOfBirth,
      confirAdult: isOver18,
      acceptedTerm: acceptsTerms,
      uiLocale
    };

    setLoading(true);
    try {
      const response = await fetch('/api/users/register/model', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(registerData) });
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
      await alert({
        title: i18n.t('auth.registerModel.success.title'),
        message: i18n.t('auth.registerModel.success.message'),
        variant: 'success',
        size: 'sm',
      });
      if (onClose) onClose();

    } catch (err) {
      setError(err.message || i18n.t('common.networkError'));
      console.error('Error en el registro:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <InlineForm noValidate>
      <Title>{i18n.t('auth.registerModel.title')}</Title>
      {error && <ErrorText role="alert">{error}</ErrorText>}

      <Field>
        <Input type="text" value={nickname} onChange={e => { setNickname(e.target.value); if (fieldErrors.nickname) setFieldErrors(f => ({ ...f, nickname: '' })); }} placeholder={i18n.t('auth.registerModel.placeholders.nickname')} required aria-invalid={!!fieldErrors.nickname} aria-describedby={fieldErrors.nickname ? 'nick-error' : undefined} autoComplete="nickname" />
        {fieldErrors.nickname && <FieldError id="nick-error">{fieldErrors.nickname}</FieldError>}
      </Field>

      <Field>
        <Input type="email" value={email} onChange={e => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors(f => ({ ...f, email: '' })); }} placeholder={i18n.t('auth.registerModel.placeholders.email')} required aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? 'email-error' : undefined} autoComplete="email" />
        {fieldErrors.email && <FieldError id="email-error">{fieldErrors.email}</FieldError>}
      </Field>

      <Field>
        <Input type="password" value={password} onChange={e => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors(f => ({ ...f, password: '' })); }} placeholder={i18n.t('auth.registerModel.placeholders.password')} required aria-invalid={!!fieldErrors.password} aria-describedby={fieldErrors.password ? 'password-error' : undefined} autoComplete="new-password" />
        {fieldErrors.password && <FieldError id="password-error">{fieldErrors.password}</FieldError>}
      </Field>

      <Field>
        <Input type="date" value={dateOfBirth} onChange={e => { setDateOfBirth(e.target.value); if (fieldErrors.dateOfBirth) setFieldErrors(f => ({ ...f, dateOfBirth: '' })); }} required aria-invalid={!!fieldErrors.dateOfBirth} aria-describedby={fieldErrors.dateOfBirth ? 'dob-error' : undefined} autoComplete="bday" />
        {fieldErrors.dateOfBirth && <FieldError id="dob-error">{fieldErrors.dateOfBirth}</FieldError>}
      </Field>

      <CheckRow>
        <CheckInput type="checkbox" checked={isOver18} onChange={e => setIsOver18(e.target.checked)} />
        <CheckText>{i18n.t('auth.registerModel.checks.over18')}</CheckText>
      </CheckRow>

      <CheckRow>
        <CheckInput type="checkbox" checked={acceptsTerms} onChange={e => setAcceptsTerms(e.target.checked)} />
        <CheckText>{i18n.t('auth.registerModel.checks.acceptPrefix')} <a href="/terms" target="_blank" rel="noreferrer">{i18n.t('auth.registerModel.checks.terms')}</a> {i18n.t('auth.registerModel.checks.and')} <a href="/privacy" target="_blank" rel="noreferrer">{i18n.t('auth.registerModel.checks.privacy')}</a></CheckText>
      </CheckRow>

      <Button type="button" disabled={loading} onClick={handleRegister}>{loading ? i18n.t('auth.registerModel.actions.loading') : i18n.t('auth.registerModel.actions.submit')}</Button>
      {onBack && <LinkButton type="button" onClick={onBack}>{i18n.t('common.back')}</LinkButton>}
    </InlineForm>
  );
};

export default RegisterModelModalContent;