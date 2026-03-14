import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import i18n from '../i18n';
import RegisterClientModalContent from './RegisterClientModalContent';
import RegisterModelModalContent from './RegisterModelModalContent';
import { useSession } from '../components/SessionProvider';
import {
  StyledForm, StyledInput, StyledButton, StyledLinkButton,
  StyledError, Status, Field, FieldError, FormTitle,
  CloseBtn as LoginCloseBtn, TabsRow, TabButton
} from '../styles/public-styles/LoginStyles';

import Roles from '../constants/Roles';
import UserTypes from '../constants/UserTypes';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';

const LoginModalContent = ({ onClose, onLoginSuccess }) => {

  const [view, setView] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const history = useHistory();
  const { refresh, user } = useSession();


  const safeNavigate = (path) => {
    if (history && typeof history.push === 'function') {
      history.push(path);
    } else {
      window.location.href = path;
    }
  };

  const readErrorMessage = async (res) => {
    if (res.status === 401) return i18n.t('auth.login.errors.invalidCredentials');
    if (res.status === 403) return i18n.t('auth.login.errors.accessDenied');
    if (res.status === 404) return i18n.t('auth.login.errors.serviceUnavailable');
    try {
      const data = await res.json();
      if (data?.message) return data.message;
    } catch {}
    return i18n.t('auth.login.errors.generic');
  };

  const validate = () => {
    const fe = { email: '', password: '' };
    if (!email.trim()) fe.email = i18n.t('auth.login.validation.emailRequired');
    else if (!/^\S+@\S+\.\S+$/.test(email)) fe.email = i18n.t('auth.login.validation.emailInvalid');
    if (!password) fe.password = i18n.t('auth.login.validation.passwordRequired');
    else if (password.length < 8) fe.password = i18n.t('auth.login.validation.passwordMin');
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
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const msg = await readErrorMessage(response);
        throw new Error(msg);
      }

      setStatus(i18n.t('auth.login.status.successRedirecting'));

      const u = await refresh();

      if (u?.role === Roles.ADMIN) {
        safeNavigate('/dashboard-admin');
      } else if (u?.role === Roles.CLIENT) {
        safeNavigate('/client');
      } else if (u?.role === Roles.MODEL) {
        safeNavigate('/model');
      } else if (u?.role === Roles.USER) {
        if (u?.userType === UserTypes.FORM_CLIENT) safeNavigate('/dashboard-user-client');
        else if (u?.userType === UserTypes.FORM_MODEL) safeNavigate('/dashboard-user-model');
        else setError(i18n.t('auth.login.errors.invalidUserType'));
      } else {
        safeNavigate('/');
      }
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      setError(err.message || i18n.t('auth.login.errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const isLoginTab = view === 'login';
  const isRegisterTab = view !== 'login';

  return (
    <StyledForm onSubmit={view === 'login' ? handleLogin : undefined} noValidate>
      {onClose && (
        <LoginCloseBtn type="button" onClick={onClose} aria-label={i18n.t('common.close')} title={i18n.t('common.close')}>
          <FontAwesomeIcon icon={faXmark} />
        </LoginCloseBtn>
      )}

      <TabsRow>
        <TabButton type="button" data-active={isLoginTab} onClick={() => setView('login')}>{i18n.t('auth.tabs.login')}</TabButton>
        <TabButton type="button" data-active={isRegisterTab} onClick={() => setView('register-gender')}>{i18n.t('auth.tabs.register')}</TabButton>
      </TabsRow>

      {view === 'login' && (
        <>
          <FormTitle>{i18n.t('auth.login.title')}</FormTitle>
          {status && <Status role="status">{status}</Status>}
          {error && <StyledError role="alert">{error}</StyledError>}

          <Field>
            <StyledInput
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors(f => ({ ...f, email: '' }));
              }}
              placeholder={i18n.t('auth.login.placeholders.email')}
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
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors(f => ({ ...f, password: '' }));
              }}
              placeholder={i18n.t('auth.login.placeholders.password')}
              required
              disabled={loading}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              autoComplete="current-password"
            />
            {fieldErrors.password && <FieldError id="password-error">{fieldErrors.password}</FieldError>}
          </Field>

          <StyledButton type="submit" disabled={loading}>
            {loading ? i18n.t('auth.login.actions.loading') : i18n.t('auth.login.actions.submit')}
          </StyledButton>

          <StyledLinkButton
            type="button"
            onClick={() => {
              if (onClose) onClose();
              safeNavigate('/forgot-password');
            }}
          >
            {i18n.t('auth.login.actions.forgotPassword')}
          </StyledLinkButton>
        </>
      )}

      {view === 'register-gender' && (
        <>
          <FormTitle>{i18n.t('auth.registerGender.title')}</FormTitle>

          <StyledButton type="button" onClick={() => setView('register-client')}>
            {i18n.t('auth.registerGender.male')}
          </StyledButton>

          <StyledButton type="button" onClick={() => setView('register-model')}>
            {i18n.t('auth.registerGender.female')}
          </StyledButton>
        </>
      )}

      {view === 'register-client' && (
        <RegisterClientModalContent
          onClose={onClose}
          onBack={() => setView('register-gender')}
        />
      )}

      {view === 'register-model' && (
        <RegisterModelModalContent
          onClose={onClose}
          onBack={() => setView('register-gender')}
        />
      )}
    </StyledForm>
  );
};

export default LoginModalContent;