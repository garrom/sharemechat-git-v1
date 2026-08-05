import React, { useCallback, useEffect, useState } from 'react';
import i18n from '../i18n';
import { apiFetch } from '../config/http';
import GoogleSignInButton from './GoogleSignInButton';
import {
  ProfileCard,
  CardHeader,
  CardTitle,
  CardSubtitle,
  CardBody,
  FormGridNew,
  FormFieldNew,
  Label,
  Input,
  Hint,
} from '../styles/subpages/PerfilClientModelStyle';
import {
  ProfilePrimaryButton,
  ProfileSecondaryButton,
  ProfileDangerOutlineButton,
} from '../styles/ButtonStyles';

/**
 * ADR-058: sección "Cuentas vinculadas" para el perfil del usuario.
 *
 * Consume los endpoints autenticados:
 * - GET  /api/users/me/oauth          → lista providers activos + hasPassword.
 * - POST /api/users/me/oauth/google/link  → vincular Google (idToken en body).
 * - DELETE /api/users/me/oauth/google → unlink Google (bloqueado si !hasPassword).
 * - POST /api/users/me/password/initial → set primera password (Google-only).
 *
 * Renderiza:
 * - Estado actual (Google linked/no).
 * - Botón GIS para link/re-link si no está linked.
 * - Botón "Desvincular Google" si linked (con warning si !hasPassword).
 * - Sub-sección "Añadir contraseña" si !hasPassword (fallback si Google cae).
 */
export default function LinkedAccountsCard() {
  const t = (key, options) => i18n.t(key, options);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [state, setState] = useState({ hasPassword: false, providers: [] });

  // Password form (solo visible si !hasPassword).
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const load = useCallback(async () => {
    setError('');
    setMsg('');
    try {
      const data = await apiFetch('/users/me/oauth', { method: 'GET' });
      setState({
        hasPassword: !!data.hasPassword,
        providers: Array.isArray(data.providers) ? data.providers : [],
      });
    } catch (e) {
      setError(e && e.message ? e.message : t('linkedAccounts.errors.load'));
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const googleLinked = state.providers.some((p) => p.provider === 'google');

  const onGoogleIdToken = useCallback(async (idToken) => {
    setError('');
    setMsg('');
    try {
      await apiFetch('/users/me/oauth/google/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      setMsg(t('linkedAccounts.google.linkedOk'));
      await load();
    } catch (e) {
      const code = e && e.data && e.data.code;
      if (code === 'ALREADY_LINKED') setError(t('linkedAccounts.errors.alreadyLinked'));
      else if (code === 'SUB_ALREADY_LINKED_TO_OTHER_USER') setError(t('linkedAccounts.errors.subOtherUser'));
      else if (code === 'GOOGLE_EMAIL_NOT_VERIFIED') setError(t('linkedAccounts.errors.googleEmailNotVerified'));
      else if (code === 'INVALID_TOKEN' || code === 'INVALID_TOKEN_PAYLOAD') setError(t('linkedAccounts.errors.invalidToken'));
      else setError((e && e.message) || t('linkedAccounts.errors.link'));
    }
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  const onUnlinkGoogle = async () => {
    setError('');
    setMsg('');
    try {
      await apiFetch('/users/me/oauth/google', { method: 'DELETE' });
      setMsg(t('linkedAccounts.google.unlinkedOk'));
      await load();
    } catch (e) {
      const code = e && e.data && e.data.code;
      if (code === 'NEEDS_PASSWORD_FIRST') setError(t('linkedAccounts.errors.needsPasswordFirst'));
      else setError((e && e.message) || t('linkedAccounts.errors.unlink'));
    }
  };

  const onSetInitialPassword = async (ev) => {
    ev.preventDefault();
    setError('');
    setMsg('');
    if (!newPassword || newPassword.length < 8) {
      setError(t('linkedAccounts.errors.passwordMin'));
      return;
    }
    setSavingPassword(true);
    try {
      await apiFetch('/users/me/password/initial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });
      setMsg(t('linkedAccounts.password.setOk'));
      setNewPassword('');
      await load();
    } catch (e) {
      const code = e && e.data && e.data.code;
      if (code === 'PASSWORD_ALREADY_SET') setError(t('linkedAccounts.errors.passwordAlreadySet'));
      else setError((e && e.message) || t('linkedAccounts.errors.password'));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <ProfileCard data-testid="linked-accounts-card">
      <CardHeader>
        <CardTitle>{t('linkedAccounts.title')}</CardTitle>
        <CardSubtitle>{t('linkedAccounts.subtitle')}</CardSubtitle>
      </CardHeader>
      <CardBody>
        {loading && <Hint>{t('common.loading')}</Hint>}
        {msg && <Hint role="status" style={{ color: '#166534' }}>{msg}</Hint>}
        {error && <Hint role="alert" style={{ color: '#b45309' }}>{error}</Hint>}

        {!loading && (
          <>
            <div style={{ marginBottom: 12 }}>
              <strong>Google:</strong>{' '}
              {googleLinked
                ? <span data-testid="google-status" style={{ color: '#166534' }}>{t('linkedAccounts.google.linked')}</span>
                : <span data-testid="google-status" style={{ color: '#6b7280' }}>{t('linkedAccounts.google.notLinked')}</span>}
            </div>

            {!googleLinked && (
              <GoogleSignInButton
                intent="login"
                onIdToken={onGoogleIdToken}
                onError={(m) => setError(m)}
              />
            )}

            {googleLinked && (
              <ProfileDangerOutlineButton
                type="button"
                onClick={onUnlinkGoogle}
                disabled={!state.hasPassword}
                title={!state.hasPassword ? t('linkedAccounts.errors.needsPasswordFirst') : ''}
              >
                {t('linkedAccounts.google.unlink')}
              </ProfileDangerOutlineButton>
            )}

            {!state.hasPassword && (
              <div style={{ marginTop: 20, borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
                <CardTitle style={{ fontSize: '1rem', marginBottom: 6 }}>
                  {t('linkedAccounts.password.title')}
                </CardTitle>
                <Hint style={{ marginBottom: 12 }}>{t('linkedAccounts.password.hint')}</Hint>
                <form onSubmit={onSetInitialPassword}>
                  <FormGridNew>
                    <FormFieldNew>
                      <Label htmlFor="linkedAccounts-newPassword">
                        {t('linkedAccounts.password.newPassword')}
                      </Label>
                      <Input
                        id="linkedAccounts-newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                        disabled={savingPassword}
                      />
                    </FormFieldNew>
                  </FormGridNew>
                  <ProfilePrimaryButton type="submit" disabled={savingPassword}>
                    {savingPassword
                      ? t('common.saving')
                      : t('linkedAccounts.password.submit')}
                  </ProfilePrimaryButton>
                </form>
              </div>
            )}
          </>
        )}
      </CardBody>
    </ProfileCard>
  );
}
