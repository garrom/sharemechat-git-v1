import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import i18n from '../i18n';
import { apiFetch } from '../config/http';
import RegisterClientModalContent from './RegisterClientModalContent';
import RegisterModelModalContent from './RegisterModelModalContent';
import RegisterMasterModalContent from './RegisterMasterModalContent';
import GoogleSignInButton from './GoogleSignInButton';
import useGoogleAuth from '../hooks/useGoogleAuth';
import { useSession } from '../components/SessionProvider';
import {
  StyledForm, StyledInput, StyledButton, StyledLinkButton,
  StyledError, Status, Field, FieldError, FormTitle,
  CloseBtn as LoginCloseBtn, TabsRow, TabButton,
  ModelRibbon, ModelRibbonIcon, ModelRibbonText
} from '../styles/public-styles/LoginStyles';

import Roles from '../constants/Roles';
import UserTypes from '../constants/UserTypes';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faVideo } from '@fortawesome/free-solid-svg-icons';
import { canAccessBackoffice } from '../utils/backofficeAccess';
import { buildAdminAppUrl, isAdminSurface, navigateToUrl, resolveHomeUrl } from '../utils/runtimeSurface';
import { isGoogleOAuthEnabled } from '../config/runtimeEnv';

const LoginModalContent = ({ onClose, onLoginSuccess, initialView = 'login', audience = null }) => {
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

  // ADR-058: handler del flujo Google Sign-In extraido a hook para
  // testeo unitario limpio (useGoogleAuth). Se pasa a
  // <GoogleSignInButton onIdToken={handleGoogleAuth} />.
  const handleGoogleAuth = useGoogleAuth({
    setError,
    setStatus,
    setLoading,
    refresh,
    safeNavigate,
    onLoginSuccess,
  });

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
  // Contexto modelo: viene de /modelos (audience='model') o vista register-model.
  // Activa la identidad roja de marca (cinta + acento) para no confundir el
  // registro/login de modelo con el de cliente.
  const isModelCtx = audience === 'model' || view === 'register-model';

  return (
    <StyledForm
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

      {isModelCtx && (
        <ModelRibbon>
          <ModelRibbonIcon aria-hidden="true">
            <FontAwesomeIcon icon={faVideo} />
          </ModelRibbonIcon>
          <ModelRibbonText>
            {i18n.t('auth.modelRibbon.title')}
            <small>{i18n.t('auth.modelRibbon.subtitle')}</small>
          </ModelRibbonText>
        </ModelRibbon>
      )}

      <TabsRow>
        <TabButton
          type="button"
          data-active={isLoginTab}
          data-accent={isModelCtx ? 'model' : undefined}
          onClick={() => setView('login')}
        >
          {i18n.t('auth.tabs.login')}
        </TabButton>

        <TabButton
          type="button"
          data-active={isRegisterTab}
          data-accent={isModelCtx ? 'model' : undefined}
          onClick={() => {
            // Preserva la intencion de registro del visitante segun de donde
            // se abrio el modal: /for-studios -> register-master, /modelos ->
            // register-model. En el resto (home, login), registro de CLIENTE
            // por defecto (Opcion B: una puerta por rol, sin selector genero).
            setView(
              initialView && initialView.startsWith('register-')
                ? initialView
                : (audience === 'model' ? 'register-model'
                  : audience === 'master' ? 'register-master'
                  : 'register-client')
            );
          }}
        >
          {i18n.t('auth.tabs.register')}
        </TabButton>
      </TabsRow>

      {view === 'login' && (
        <>
          <FormTitle>{audience === 'model' ? i18n.t('auth.login.titleModel') : i18n.t('auth.login.title')}</FormTitle>

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

          {/* ADR-058: separador + boton Google Sign-In para login. Envolvente
              con flag isGoogleOAuthEnabled (Estrategia 3, 2026-08-07): en PROD
              se oculta hasta que se publique consent Google Cloud.
              Google (registro/login) es solo para CLIENTES; en el contexto
              modelo (audience='model', desde /modelos) no aplica -> se oculta. */}
          {isGoogleOAuthEnabled() && audience !== 'model' && (
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
                intent="login"
                onIdToken={handleGoogleAuth}
                onError={(msg) => setError(msg)}
              />
            </>
          )}
        </>
      )}

      {view === 'register-client' && (
        <RegisterClientModalContent
          onClose={onClose}
          onGoogleAuth={handleGoogleAuth}
        />
      )}

      {view === 'register-model' && (
        <RegisterModelModalContent
          onClose={onClose}
        />
      )}

      {view === 'register-master' && (
        <RegisterMasterModalContent
          onClose={onClose}
          onBack={() => setView('login')}
        />
      )}
    </StyledForm>
  );
};

export default LoginModalContent;
