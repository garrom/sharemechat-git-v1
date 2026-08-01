import React, { useState } from 'react';
import styled from 'styled-components';
import i18n from '../i18n';
import { apiFetch } from '../config/http';
import { getResolvedLocale } from '../i18n/localeUtils';
import { Form as RegForm, Title, Input, Button, LinkButton, Error as ErrorText, Field, FieldError, CheckRow, CheckInput, CheckText } from '../styles/public-styles/RegisterClientModelStyles';
import { useAppModals } from './useAppModals';
import { pushSignUp, getAcquisitionPayload } from '../utils/attribution';

// ADR-056 Fase S5.b: formulario de registro Master (Opcion A). Alineado con
// RegisterMasterRequestDTO: email + password (>=10) + dateOfBirth + nickname
// + confirAdult + acceptedTerm + uiLocale. Campos empresa opcionales
// (companyName + companyRegistrationNumber + companyCountry). Post-alta,
// el Master debe firmar contrato y superar KYC via su dashboard.

const InlineForm = styled(RegForm)`
  background: transparent;
  border: 0;
  box-shadow: none;
  margin: 0;
  padding: 0;
`;

const Intro = styled.p`
  color: #4b5563;
  font-size: 0.9rem;
  line-height: 1.5;
  margin: 4px 0 12px;
`;

const SectionLabel = styled.div`
  color: #6b7280;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin: 14px 0 6px;
`;

const RegisterMasterModalContent = ({ onClose, onBack }) => {
  const { alert } = useAppModals();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyRegistrationNumber, setCompanyRegistrationNumber] = useState('');
  const [companyCountry, setCompanyCountry] = useState('');
  const [isOver18, setIsOver18] = useState(false);
  const [acceptsTerms, setAcceptsTerms] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '', nickname: '', dateOfBirth: '', companyCountry: '' });
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const fe = { email: '', password: '', nickname: '', dateOfBirth: '', companyCountry: '' };
    if (!email.trim()) fe.email = i18n.t('auth.registerMaster.validation.emailRequired');
    else if (!/^\S+@\S+\.\S+$/.test(email)) fe.email = i18n.t('auth.registerMaster.validation.emailInvalid');
    if (!password || password.length < 10) fe.password = i18n.t('auth.registerMaster.validation.passwordMin');
    else if (/\s/.test(password)) fe.password = i18n.t('auth.registerMaster.validation.passwordNoSpaces');
    if (!nickname.trim()) fe.nickname = i18n.t('auth.registerMaster.validation.nicknameRequired');
    else if (!/^[\p{L}\p{N}._-]{3,30}$/u.test(nickname.trim())) fe.nickname = i18n.t('auth.registerMaster.validation.nicknamePattern');
    if (!dateOfBirth) fe.dateOfBirth = i18n.t('auth.registerMaster.validation.dateOfBirthRequired');
    else {
      const d = new Date(dateOfBirth + 'T00:00:00');
      if (isNaN(d.getTime()) || d.getTime() >= Date.now()) fe.dateOfBirth = i18n.t('auth.registerMaster.validation.dateOfBirthPast');
    }
    if (companyCountry.trim() && !/^[A-Za-z]{2}$/.test(companyCountry.trim())) {
      fe.companyCountry = i18n.t('auth.registerMaster.validation.companyCountryFormat');
    }
    setFieldErrors(fe);
    return !fe.email && !fe.password && !fe.nickname && !fe.dateOfBirth && !fe.companyCountry;
  };

  const handleRegister = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (loading) return;
    setError('');
    if (!validate()) return;
    if (!isOver18) return setError(i18n.t('auth.registerMaster.validation.confirmAdult'));
    if (!acceptsTerms) return setError(i18n.t('auth.registerMaster.validation.acceptTerms'));

    const uiLocale = getResolvedLocale(i18n);
    const payload = {
      email: email.trim(),
      password,
      nickname: nickname.trim(),
      dateOfBirth,
      confirAdult: isOver18,
      acceptedTerm: acceptsTerms,
      uiLocale,
    };
    if (companyName.trim()) payload.companyName = companyName.trim();
    if (companyRegistrationNumber.trim()) payload.companyRegistrationNumber = companyRegistrationNumber.trim();
    if (companyCountry.trim()) payload.companyCountry = companyCountry.trim().toUpperCase();
    // Capa B atribucion (ADR-057): first-touch para persistir en backend.
    payload.acquisition = getAcquisitionPayload();

    setLoading(true);
    try {
      await apiFetch('/masters/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // Atribución de origen (capa A): evento GA4 vía dataLayer con los UTM
      // first-touch. Sin PII. Respeta consentimiento y solo llega a GA4 en
      // PROD (ver utils/attribution.js). No debe romper el flujo de registro.
      pushSignUp({ userType: 'master' });

      await alert({
        title: i18n.t('auth.registerMaster.success.title'),
        message: i18n.t('auth.registerMaster.success.message'),
        variant: 'success',
        size: 'sm',
      });

      if (onClose) onClose();
    } catch (err) {
      setError(err?.data?.message || err?.message || i18n.t('common.networkError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <InlineForm noValidate>
      <Title>{i18n.t('auth.registerMaster.title')}</Title>
      <Intro>{i18n.t('auth.registerMaster.intro')}</Intro>
      {error && <ErrorText role="alert">{error}</ErrorText>}

      <SectionLabel>{i18n.t('auth.registerMaster.sections.personal')}</SectionLabel>

      <Field>
        <Input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: '' })); }}
          placeholder={i18n.t('auth.registerMaster.placeholders.email')}
          required
          aria-invalid={!!fieldErrors.email}
          autoComplete="email"
        />
        {fieldErrors.email && <FieldError>{fieldErrors.email}</FieldError>}
      </Field>

      <Field>
        <Input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: '' })); }}
          placeholder={i18n.t('auth.registerMaster.placeholders.password')}
          required
          aria-invalid={!!fieldErrors.password}
          autoComplete="new-password"
        />
        {fieldErrors.password && <FieldError>{fieldErrors.password}</FieldError>}
      </Field>

      <Field>
        <Input
          type="text"
          value={nickname}
          onChange={(e) => { setNickname(e.target.value); if (fieldErrors.nickname) setFieldErrors((f) => ({ ...f, nickname: '' })); }}
          placeholder={i18n.t('auth.registerMaster.placeholders.nickname')}
          required
          aria-invalid={!!fieldErrors.nickname}
          autoComplete="username"
        />
        {fieldErrors.nickname && <FieldError>{fieldErrors.nickname}</FieldError>}
      </Field>

      <Field>
        <Input
          type="date"
          value={dateOfBirth}
          onChange={(e) => { setDateOfBirth(e.target.value); if (fieldErrors.dateOfBirth) setFieldErrors((f) => ({ ...f, dateOfBirth: '' })); }}
          required
          aria-invalid={!!fieldErrors.dateOfBirth}
          autoComplete="bday"
        />
        {fieldErrors.dateOfBirth && <FieldError>{fieldErrors.dateOfBirth}</FieldError>}
      </Field>

      <SectionLabel>{i18n.t('auth.registerMaster.sections.company')}</SectionLabel>

      <Field>
        <Input
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder={i18n.t('auth.registerMaster.placeholders.companyName')}
          maxLength={200}
          autoComplete="organization"
        />
      </Field>

      <Field>
        <Input
          type="text"
          value={companyRegistrationNumber}
          onChange={(e) => setCompanyRegistrationNumber(e.target.value)}
          placeholder={i18n.t('auth.registerMaster.placeholders.companyRegistrationNumber')}
          maxLength={100}
        />
      </Field>

      <Field>
        <Input
          type="text"
          value={companyCountry}
          onChange={(e) => { setCompanyCountry(e.target.value); if (fieldErrors.companyCountry) setFieldErrors((f) => ({ ...f, companyCountry: '' })); }}
          placeholder={i18n.t('auth.registerMaster.placeholders.companyCountry')}
          maxLength={2}
          aria-invalid={!!fieldErrors.companyCountry}
          autoComplete="country"
        />
        {fieldErrors.companyCountry && <FieldError>{fieldErrors.companyCountry}</FieldError>}
      </Field>

      <CheckRow>
        <CheckInput type="checkbox" checked={isOver18} onChange={(e) => setIsOver18(e.target.checked)} />
        <CheckText>{i18n.t('auth.registerMaster.checks.over18')}</CheckText>
      </CheckRow>

      <CheckRow>
        <CheckInput type="checkbox" checked={acceptsTerms} onChange={(e) => setAcceptsTerms(e.target.checked)} />
        <CheckText>
          {i18n.t('auth.registerMaster.checks.acceptPrefix')}{' '}
          <a href="/legal?tab=terms" target="_blank" rel="noreferrer">{i18n.t('auth.registerMaster.checks.terms')}</a>{' '}
          {i18n.t('auth.registerMaster.checks.and')}{' '}
          <a href="/legal?tab=privacy" target="_blank" rel="noreferrer">{i18n.t('auth.registerMaster.checks.privacy')}</a>
        </CheckText>
      </CheckRow>

      <CheckText style={{ color: '#6b7280', fontSize: '0.82rem', marginTop: 6, marginBottom: 6 }}>
        {i18n.t('auth.registerMaster.checks.contractPending')}
      </CheckText>

      <Button type="button" disabled={loading} onClick={handleRegister}>
        {loading ? i18n.t('auth.registerMaster.actions.loading') : i18n.t('auth.registerMaster.actions.submit')}
      </Button>
      {onBack && <LinkButton type="button" onClick={onBack}>{i18n.t('common.back')}</LinkButton>}
    </InlineForm>
  );
};

export default RegisterMasterModalContent;
