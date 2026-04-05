import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import i18n from '../i18n';
import { apiFetch } from '../config/http';
import RegisterClientModalContent from './RegisterClientModalContent';
import RegisterModelModalContent from './RegisterModelModalContent';
import { useSession } from '../components/SessionProvider';
import {
  StyledForm, StyledInput, StyledButton, StyledLinkButton,
  StyledError, Status, Field, FieldError, FormTitle,
  CloseBtn as LoginCloseBtn, TabsRow, TabButton, RegisterGenderRow
} from '../styles/public-styles/LoginStyles';

import Roles from '../constants/Roles';
import UserTypes from '../constants/UserTypes';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { canAccessBackoffice } from '../utils/backofficeAccess';
import { buildAdminAppUrl, isAdminSurface, navigateToUrl, resolveHomeUrl } from '../utils/runtimeSurface';

const LoginModalContent = ({ onClose, onLoginSuccess, initialView = 'login' }) => {
  const [view, setView] = useState(initialView);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const history = useHistory();
  const { refresh } = useSession();

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  const safeNavigate = (path) => {
    navigateToUrl(path, history);
  };

  const validate = () => {
    const fe = { email: '', password: '' };

    if (!email.trim()) {
      fe.email = i18n.t('auth.login.validation.emailRequired');
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      fe.email = i18n.t('auth.login.validation.emailInvalid');
    }

    if (!password) {
      fe.password = i18n.t('auth.login.validation.passwordRequired');
    } else if (password.length < 8) {
      fe.password = i18n.t('auth.login.validation.passwordMin');
    }

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
      const loginPath = isAdminSurface() ? '/admin/auth/login' : '/auth/login';

      await apiFetch(loginPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      setStatus(i18n.t('auth.login.status.successRedirecting'));

      const u = await refresh();

      if (
        !isAdminSurface()
        && u?.role === Roles.USER
        && u?.userType !== UserTypes.FORM_CLIENT
        && u?.userType !== UserTypes.FORM_MODEL
        && !canAccessBackoffice(u)
      ) {
        setError(i18n.t('auth.login.errors.invalidUserType'));
        return;
      }

      const target = isAdminSurface()
        ? buildAdminAppUrl('/dashboard-admin')
        : resolveHomeUrl(u);

      safeNavigate(target);

      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err) {
      const backendMessage = err?.data?.message;
      const backendText = typeof err?.text === 'string' && err.text.trim() ? err.text.trim() : '';
      const statusCode = Number(err?.status);

      if (backendMessage) {
        setError(backendMessage);
      } else if (isAdminSurface() && statusCode === 403 && backendText) {
        setError(backendText);
      } else if (statusCode === 401) {
        setError(i18n.t('auth.login.errors.invalidCredentials'));
      } else if (statusCode === 403) {
        setError(i18n.t('auth.login.errors.accessDenied'));
      } else if (statusCode === 404) {
        setError(i18n.t('auth.login.errors.serviceUnavailable'));
      } else {
        setError(err?.message || i18n.t('auth.login.errors.generic'));
      }
    } finally {
      setLoading(false);
    }
  };

  const isLoginTab = view === 'login';
  const isRegisterTab = view !== 'login';
  const isRegisterGenderView = view === 'register-gender';

  return (
    <StyledForm
      $wide={isRegisterGenderView}
      onSubmit={view === 'login' ? handleLogin : undefined}
      noValidate
    >
      {onClose && (
        <LoginCloseBtn
          type="button"
          onClick={onClose}
          aria-label={i18n.t('common.close')}
          title={i18n.t('common.close')}
        >
          <FontAwesomeIcon icon={faXmark} />
        </LoginCloseBtn>
      )}

      <TabsRow>
        <TabButton
          type="button"
          data-active={isLoginTab}
          onClick={() => setView('login')}
        >
          {i18n.t('auth.tabs.login')}
        </TabButton>

        <TabButton
          type="button"
          data-active={isRegisterTab}
          onClick={() => setView('register-gender')}
        >
          {i18n.t('auth.tabs.register')}
        </TabButton>
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
                if (fieldErrors.email) {
                  setFieldErrors((f) => ({ ...f, email: '' }));
                }
              }}
              placeholder={i18n.t('auth.login.placeholders.email')}
              required
              disabled={loading}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              autoComplete="username"
            />
            {fieldErrors.email && (
              <FieldError id="email-error">{fieldErrors.email}</FieldError>
            )}
          </Field>

          <Field>
            <StyledInput
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((f) => ({ ...f, password: '' }));
                }
              }}
              placeholder={i18n.t('auth.login.placeholders.password')}
              required
              disabled={loading}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              autoComplete="current-password"
            />
            {fieldErrors.password && (
              <FieldError id="password-error">{fieldErrors.password}</FieldError>
            )}
          </Field>

          <StyledButton type="submit" disabled={loading}>
            {loading
              ? i18n.t('auth.login.actions.loading')
              : i18n.t('auth.login.actions.submit')}
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

          <RegisterGenderRow>
            <StyledButton type="button" onClick={() => setView('register-client')}>
              {i18n.t('auth.registerGender.male')}
            </StyledButton>

            <StyledButton type="button" onClick={() => setView('register-model')}>
              {i18n.t('auth.registerGender.female')}
            </StyledButton>
          </RegisterGenderRow>
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
