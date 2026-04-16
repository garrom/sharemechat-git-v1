import React, { useMemo, useState } from 'react';
import i18n from '../../i18n';
import { useSession } from '../../components/SessionProvider';
import { apiFetch } from '../../config/http';
import {
  FieldBlock,
  InlinePanel,
  PanelRow,
  StyledButton,
  StyledError,
} from '../../styles/AdminStyles';

const infoValueStyle = {
  fontSize: 13,
  color: '#162033',
  lineHeight: 1.5,
  wordBreak: 'break-word',
};

const okStyle = {
  color: '#2f5d37',
  margin: '8px 0',
  fontSize: 12,
};

const inputStyle = {
  width: '100%',
  padding: '8px 9px',
  border: '1px solid #bcc6d1',
  borderRadius: 4,
  fontSize: 12,
  color: '#18212f',
  background: '#fff',
};

const AdminProfilePage = () => {
  const t = (key, options) => i18n.t(key, options);
  const formatDateTime = (value) => {
    if (!value) return t('admin.profile.notAvailable');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString(i18n.resolvedLanguage || i18n.language);
  };

  const { user } = useSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const effectiveBackofficeRoles = useMemo(() => (
    Array.isArray(user?.backofficeRoles) ? user.backofficeRoles.filter(Boolean) : []
  ), [user]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(t('admin.profile.password.errors.missingFields'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('admin.profile.password.errors.mismatch'));
      return;
    }
    if (newPassword.length < 10) {
      setError(t('admin.profile.password.errors.minLength'));
      return;
    }
    if (/\s/.test(newPassword)) {
      setError(t('admin.profile.password.errors.noSpaces'));
      return;
    }

    try {
      setSubmitting(true);
      await apiFetch('/users/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(t('admin.profile.password.success'));
    } catch (e) {
      setError(e.message || t('admin.profile.password.errors.update'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <InlinePanel>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#74819a', marginBottom: 10 }}>
          {t('admin.profile.basicData.title')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <FieldBlock>
            <label>{t('admin.profile.fields.email')}</label>
            <div style={infoValueStyle}>{user?.email || t('admin.profile.notAvailable')}</div>
          </FieldBlock>
          <FieldBlock>
            <label>{t('admin.profile.fields.nickname')}</label>
            <div style={infoValueStyle}>{user?.nickname || t('admin.profile.notAvailable')}</div>
          </FieldBlock>
          <FieldBlock>
            <label>{t('admin.profile.fields.productRole')}</label>
            <div style={infoValueStyle}>{user?.role || t('admin.profile.notAvailable')}</div>
          </FieldBlock>
          <FieldBlock>
            <label>{t('admin.profile.fields.backofficeRoles')}</label>
            <div style={infoValueStyle}>
              {effectiveBackofficeRoles.length > 0
                ? effectiveBackofficeRoles.join(', ')
                : t('admin.profile.noEffectiveRoles')}
            </div>
          </FieldBlock>
          <FieldBlock>
            <label>{t('admin.profile.fields.emailVerified')}</label>
            <div style={infoValueStyle}>
              {user?.emailVerifiedAt
                ? t('admin.profile.emailVerifiedYes', { date: formatDateTime(user.emailVerifiedAt) })
                : t('admin.profile.emailVerifiedNo')}
            </div>
          </FieldBlock>
          <FieldBlock>
            <label>{t('admin.profile.fields.accountStatus')}</label>
            <div style={infoValueStyle}>{user?.accountStatus || t('admin.profile.notAvailable')}</div>
          </FieldBlock>
          <FieldBlock>
            <label>{t('admin.profile.fields.uiLanguage')}</label>
            <div style={infoValueStyle}>{user?.uiLocale || t('admin.profile.notAvailable')}</div>
          </FieldBlock>
          <FieldBlock>
            <label>{t('admin.profile.fields.userId')}</label>
            <div style={infoValueStyle}>{user?.id ?? t('admin.profile.notAvailable')}</div>
          </FieldBlock>
        </div>
      </InlinePanel>

      <InlinePanel>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#74819a', marginBottom: 10 }}>
          {t('admin.profile.password.title')}
        </div>
        <div style={{ fontSize: 12, color: '#52607a', marginBottom: 10, lineHeight: 1.55 }}>
          {t('admin.profile.password.description')}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: 12 }}>
            <FieldBlock>
              <label>{t('admin.profile.password.fields.current')}</label>
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                style={inputStyle}
              />
            </FieldBlock>
            <FieldBlock>
              <label>{t('admin.profile.password.fields.next')}</label>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                style={inputStyle}
              />
            </FieldBlock>
            <FieldBlock>
              <label>{t('admin.profile.password.fields.confirm')}</label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                style={inputStyle}
              />
            </FieldBlock>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: '#52607a', lineHeight: 1.55 }}>
            {t('admin.profile.password.hint')}
          </div>

          {error ? <StyledError>{error}</StyledError> : null}
          {success ? <div style={okStyle}>{success}</div> : null}

          <PanelRow>
            <StyledButton type="submit" disabled={submitting}>
              {submitting ? t('admin.profile.password.actions.submitting') : t('admin.profile.password.actions.submit')}
            </StyledButton>
          </PanelRow>
        </form>
      </InlinePanel>
    </div>
  );
};

export default AdminProfilePage;
