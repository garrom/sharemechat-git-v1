import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import i18n from '../i18n';
import { apiFetch } from '../config/http';
import { getResolvedLocale } from '../i18n/localeUtils';
import { registerErrorMessage } from '../i18n/registerErrorMessage';
import { normalizeNickname } from '../utils/normalizeNickname';
import InfoTooltip from './InfoTooltip';
import { Form as RegForm, Title, Input, Button, Error as ErrorText, Field, FieldError, Hint, CheckRow, CheckInput, CheckText } from '../styles/public-styles/RegisterClientModelStyles';
import { useAppModals } from './useAppModals';
import { pushSignUp, getAcquisitionPayload } from '../utils/attribution';
import GoogleSignInButton from './GoogleSignInButton';
import { isGoogleOAuthEnabled } from '../config/runtimeEnv';

const InlineForm = styled(RegForm)`
  background: transparent;
  border: 0;
  box-shadow: none;
  margin: 0;
  padding: 0;
`;

const RegisterClientModalContent = ({ onClose, onGoogleAuth }) => {

  const { alert } = useAppModals();
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isOver18, setIsOver18] = useState(false);
  const [acceptsTerms, setAcceptsTerms] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ nickname: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);


  const validate = () => {
    const fe = { nickname: '', email: '', password: '' };
    if (!nickname.trim()) fe.nickname = i18n.t('auth.registerClient.validation.nicknameRequired');
    else if (normalizeNickname(nickname).length < 3) fe.nickname = i18n.t('auth.registerClient.validation.nicknameTooShort');
    if (!email.trim()) fe.email = i18n.t('auth.registerClient.validation.emailRequired');
    else if (!/^\S+@\S+\.\S+$/.test(email)) fe.email = i18n.t('auth.registerClient.validation.emailInvalid');
    if (password.length < 8) fe.password = i18n.t('auth.registerClient.validation.passwordMin');
    setFieldErrors(fe);
    return !fe.nickname && !fe.email && !fe.password;
  };

  const handleRegister = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (loading) return;
    setError('');
    if (!validate()) return;
    if (!isOver18) return setError(i18n.t('auth.registerClient.validation.confirmAdult'));
    if (!acceptsTerms) return setError(i18n.t('auth.registerClient.validation.acceptTerms'));

    const uiLocale = getResolvedLocale(i18n);

    const registerData = {
      nickname: normalizeNickname(nickname),
      email,
      password,
      confirAdult: isOver18,
      acceptedTerm: acceptsTerms,
      uiLocale,
      // Capa B atribucion (ADR-057): first-touch para persistir en backend.
      // Sin PII; null si no hay consentimiento/cookie.
      acquisition: getAcquisitionPayload()
    };

    setLoading(true);
    try {
      await apiFetch('/users/register/client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerData)
      });

      // Atribución de origen (capa A): evento GA4 vía dataLayer con los UTM
      // first-touch. Sin PII. Respeta consentimiento y solo llega a GA4 en
      // PROD (ver utils/attribution.js). No debe romper el flujo de registro.
      pushSignUp({ userType: 'client' });

      await alert({
        title: i18n.t('auth.registerClient.success.title'),
        message: i18n.t('auth.registerClient.success.message'),
        variant: 'success',
        size: 'sm',
      });

      if (onClose) onClose();
    } catch (err) {
      setError(registerErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const nickPreview = normalizeNickname(nickname);
  const showNickHint = !!nickname.trim() && nickPreview !== nickname.trim() && nickPreview.length >= 3;

  return (
    <InlineForm noValidate>
      <Title>{i18n.t('auth.registerClient.title')}</Title>
      {error && <ErrorText role="alert">{error}</ErrorText>}

      <Field>
        <InfoTooltip text={i18n.t('common.fieldInfo.nicknameHelp')} ariaLabel={i18n.t('common.fieldInfo.infoAriaLabel')}>
          <Input type="text" value={nickname} onChange={e => { setNickname(e.target.value); if (fieldErrors.nickname) setFieldErrors(f => ({ ...f, nickname: '' })); }} placeholder={i18n.t('auth.registerClient.placeholders.nickname')} required aria-invalid={!!fieldErrors.nickname} aria-describedby={fieldErrors.nickname ? 'nick-error' : undefined} autoComplete="nickname" style={{ paddingRight: 44 }} />
        </InfoTooltip>
        {fieldErrors.nickname && <FieldError id="nick-error">{fieldErrors.nickname}</FieldError>}
        {!fieldErrors.nickname && showNickHint && (
          <Hint>{i18n.t('auth.registerClient.validation.nicknameNormalizedHint')} <strong>{nickPreview}</strong></Hint>
        )}
      </Field>

      <Field>
        <Input type="email" value={email} onChange={e => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors(f => ({ ...f, email: '' })); }} placeholder={i18n.t('auth.registerClient.placeholders.email')} required aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? 'email-error' : undefined} autoComplete="email" />
        {fieldErrors.email && <FieldError id="email-error">{fieldErrors.email}</FieldError>}
      </Field>

      <Field>
        <Input type="password" value={password} onChange={e => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors(f => ({ ...f, password: '' })); }} placeholder={i18n.t('auth.registerClient.placeholders.password')} required aria-invalid={!!fieldErrors.password} aria-describedby={fieldErrors.password ? 'password-error' : undefined} autoComplete="new-password" />
        {fieldErrors.password && <FieldError id="password-error">{fieldErrors.password}</FieldError>}
      </Field>

      <CheckRow>
        <CheckInput type="checkbox" checked={isOver18} onChange={e => setIsOver18(e.target.checked)} />
        <CheckText>{i18n.t('auth.registerClient.checks.over18')}</CheckText>
      </CheckRow>

      <CheckRow>
        <CheckInput type="checkbox" checked={acceptsTerms} onChange={e => setAcceptsTerms(e.target.checked)} />
        <CheckText>{i18n.t('auth.registerClient.checks.acceptPrefix')} <a href="/legal?tab=terms" target="_blank" rel="noreferrer">{i18n.t('auth.registerClient.checks.terms')}</a> {i18n.t('auth.registerClient.checks.and')} <a href="/legal?tab=privacy" target="_blank" rel="noreferrer">{i18n.t('auth.registerClient.checks.privacy')}</a></CheckText>
      </CheckRow>

      <Button type="button" disabled={loading} onClick={handleRegister}>{loading ? i18n.t('auth.registerClient.actions.loading') : i18n.t('auth.registerClient.actions.submit')}</Button>

      {/* ADR-058: Google Sign-In como atajo dentro del form de registro cliente.
          Se coloca despues del boton principal para no competir con el flujo
          nativo (email+password). Solo se muestra si el padre provee handler.
          Además: flag isGoogleOAuthEnabled (Estrategia 3, 2026-08-07) — en PROD
          se oculta hasta que se publique consent Google Cloud. */}
      {onGoogleAuth && isGoogleOAuthEnabled() && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              margin: '12px 0 8px',
              color: '#6b7280',
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            <span style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
            <span>{i18n.t('auth.google.orSeparator')}</span>
            <span style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
          </div>
          <GoogleSignInButton
            intent="register-client"
            onIdToken={onGoogleAuth}
            onError={(msg) => setError(msg)}
          />
        </>
      )}
    </InlineForm>
  );
};

export default RegisterClientModalContent;
