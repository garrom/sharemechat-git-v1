// PerfilMaster.jsx — ADR-056 Fase S5.a (iter.6 layout unificado 2026-08-02).
// Refactor visual para reutilizar el patrón de PerfilClient/PerfilModel:
//   ProfileHeader (avatar + nombre + chip MASTER + meta) +
//   ProfileGrid 2 col (izq datos básicos + empresa; der onboarding + seguridad).
// Datos de empresa siguen siendo readonly (edición en admin, deuda pendiente
// de PATCH autoservicio en /api/masters/me).
import React, { useCallback, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import i18n from '../../i18n';
import { apiFetch } from '../../config/http';
import masterApi from '../../api/masterApi';
import LocaleSwitcher from '../../components/LocaleSwitcher';
import {
  StyledContainer,
  StyledNavbar,
  StyledBrand,
} from '../../styles/NavbarStyles';
import {
  NavButton,
  ProfilePrimaryButton,
  ProfileSecondaryButton,
} from '../../styles/ButtonStyles';
import {
  Message,
  Label,
  Input,
  Hint,
  ProfileMain,
  ProfileHeader,
  ProfileHeaderAvatar,
  Avatar,
  ProfileHeaderInfo,
  ProfileHeaderTitleRow,
  ProfileHeaderName,
  ChipRole,
  ProfileHeaderSubtitle,
  ProfileHeaderMeta,
  MetaItem,
  MetaLabel,
  MetaValue,
  MetaValueOk,
  ProfileGrid,
  ProfileColMain,
  ProfileColSide,
  ProfileCard,
  SecurityCard,
  CardHeader,
  CardTitle,
  CardSubtitle,
  CardBody,
  CardFooter,
  FormGridNew,
  FormFieldNew,
  SecurityActions,
} from '../../styles/subpages/PerfilClientModelStyle';

const t = (k) => i18n.t(k);

// Estilos locales solo para el bloque "estado onboarding" (badges).
const readonlyInput = {
  background: '#f5f5f5',
  color: '#555',
  cursor: 'not-allowed',
};
const OnboardingRow = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 0',
  borderBottom: '1px solid #f3f4f6',
};
const OnboardingRowLast = { ...OnboardingRow, borderBottom: 'none' };
const OnboardingLabel = { fontSize: '0.92rem', color: '#334155' };
const badge = (variant) => {
  const map = {
    ok: { bg: '#dcfce7', fg: '#166534' },
    pending: { bg: '#fef3c7', fg: '#92400e' },
    error: { bg: '#fee2e2', fg: '#991b1b' },
  };
  const c = map[variant] || map.pending;
  return {
    display: 'inline-block', padding: '3px 12px', borderRadius: 999,
    fontSize: '0.75rem', fontWeight: 600, background: c.bg, color: c.fg,
  };
};

export default function PerfilMaster() {
  const history = useHistory();
  const [me, setMe] = useState(null);
  const [form, setForm] = useState({ nickname: '', name: '', surname: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [meDto, userDto] = await Promise.all([
        masterApi.getMe(),
        apiFetch('/users/me'),
      ]);
      setMe(meDto);
      setForm({
        nickname: userDto?.nickname || meDto?.nickname || '',
        name: userDto?.name || '',
        surname: userDto?.surname || '',
      });
    } catch (err) {
      setError(err?.data?.error || err?.message || t('common.networkError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (msg) setMsg('');
    if (error) setError('');
  };

  const handleSave = async () => {
    if (!me?.userId || saving) return;
    setSaving(true);
    setError('');
    setMsg('');
    try {
      await apiFetch(`/users/${me.userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: form.nickname || null,
          name: form.name || null,
          surname: form.surname || null,
        }),
      });
      setMsg(t('perfilMaster.status.saved'));
    } catch (err) {
      setError(err?.data?.message || err?.message || t('perfilMaster.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => history.push('/master');
  const handleChangePassword = () => history.push('/change-password');

  const displayName = form.nickname || me?.nickname || me?.email || t('perfilMaster.title');
  const initial = (displayName || '?').trim().charAt(0).toUpperCase();

  const emailVerifiedBadge = me?.emailVerified
    ? <span style={badge('ok')}>{t('perfilMaster.status.ok')}</span>
    : <span style={badge('pending')}>{t('perfilMaster.status.pending')}</span>;
  const kycStatusBadge = (() => {
    if (me?.verificationStatus === 'APPROVED') return <span style={badge('ok')}>{t('perfilMaster.status.approved')}</span>;
    if (me?.verificationStatus === 'REJECTED') return <span style={badge('error')}>{t('perfilMaster.status.rejected')}</span>;
    return <span style={badge('pending')}>{t('perfilMaster.status.pending')}</span>;
  })();
  const contractBadge = me?.contractAccepted
    ? <span style={badge('ok')}>{t('perfilMaster.status.ok')}</span>
    : <span style={badge('pending')}>{t('perfilMaster.status.pending')}</span>;

  return (
    <StyledContainer>
      <StyledNavbar>
        <StyledBrand
          href="/master"
          aria-label="SharemeChat"
          onClick={(e) => { e.preventDefault(); handleBack(); }}
        />
        <div>
          <NavButton type="button" onClick={handleBack}>
            {t('perfilMaster.back')}
          </NavButton>
        </div>
      </StyledNavbar>

      <ProfileMain>
        <ProfileHeader>
          <ProfileHeaderAvatar>
            <Avatar>
              <span style={{ fontSize: 22, fontWeight: 600, color: '#3730a3' }}>{initial}</span>
            </Avatar>
          </ProfileHeaderAvatar>
          <ProfileHeaderInfo>
            <ProfileHeaderTitleRow>
              <ProfileHeaderName>{displayName}</ProfileHeaderName>
              <ChipRole>{t('perfilMaster.role')}</ChipRole>
            </ProfileHeaderTitleRow>
            <ProfileHeaderSubtitle>
              {t('perfilMaster.header.subtitle')}
            </ProfileHeaderSubtitle>
            <ProfileHeaderMeta>
              <MetaItem>
                <MetaLabel>{t('profileCommon.labels.status')}</MetaLabel>
                <MetaValueOk>{t('profileCommon.status.active')}</MetaValueOk>
              </MetaItem>
              <MetaItem>
                <MetaLabel>{t('profileCommon.labels.email')}</MetaLabel>
                <MetaValue>{me?.email || t('profileCommon.empty.value')}</MetaValue>
              </MetaItem>
              <MetaItem>
                <MetaLabel>{t('profileCommon.labels.language')}</MetaLabel>
                <LocaleSwitcher />
              </MetaItem>
            </ProfileHeaderMeta>
          </ProfileHeaderInfo>
        </ProfileHeader>

        {loading && <p>{t('common.loading')}</p>}
        {error && <Message type="error">{error}</Message>}
        {msg && <Message type="ok">{msg}</Message>}

        {!loading && me && (
          <ProfileGrid>
            <ProfileColMain>
              <ProfileCard>
                <CardHeader>
                  <CardTitle>{t('perfilMaster.sections.basic')}</CardTitle>
                  <CardSubtitle>{t('perfilMaster.sections.basicSubtitle')}</CardSubtitle>
                </CardHeader>
                <CardBody>
                  <FormGridNew>
                    <FormFieldNew>
                      <Label>{t('perfilMaster.labels.nickname')}</Label>
                      <Input
                        name="nickname"
                        value={form.nickname}
                        onChange={onChange}
                        placeholder={t('perfilMaster.labels.nickname')}
                      />
                    </FormFieldNew>
                    <FormFieldNew>
                      <Label>{t('perfilMaster.labels.email')}</Label>
                      <Input value={me.email || ''} readOnly style={readonlyInput} />
                    </FormFieldNew>
                    <FormFieldNew>
                      <Label>{t('perfilMaster.labels.name')}</Label>
                      <Input
                        name="name"
                        value={form.name}
                        onChange={onChange}
                      />
                    </FormFieldNew>
                    <FormFieldNew>
                      <Label>{t('perfilMaster.labels.surname')}</Label>
                      <Input
                        name="surname"
                        value={form.surname}
                        onChange={onChange}
                      />
                    </FormFieldNew>
                  </FormGridNew>
                </CardBody>
                <CardFooter>
                  <ProfilePrimaryButton type="button" onClick={handleSave} disabled={saving}>
                    {saving ? t('perfilMaster.actions.saving') : t('perfilMaster.actions.save')}
                  </ProfilePrimaryButton>
                </CardFooter>
              </ProfileCard>

              <ProfileCard>
                <CardHeader>
                  <CardTitle>{t('perfilMaster.sections.company')}</CardTitle>
                  <CardSubtitle>{t('perfilMaster.company.readOnlyHint')}</CardSubtitle>
                </CardHeader>
                <CardBody>
                  <FormGridNew>
                    <FormFieldNew>
                      <Label>{t('perfilMaster.labels.companyName')}</Label>
                      <Input value={me.companyName || t('perfilMaster.empty')} readOnly style={readonlyInput} />
                    </FormFieldNew>
                    <FormFieldNew>
                      <Label>{t('perfilMaster.labels.companyCountry')}</Label>
                      <Input value={me.companyCountry || t('perfilMaster.empty')} readOnly style={readonlyInput} />
                    </FormFieldNew>
                  </FormGridNew>
                </CardBody>
              </ProfileCard>
            </ProfileColMain>

            <ProfileColSide>
              <ProfileCard>
                <CardHeader>
                  <CardTitle>{t('perfilMaster.sections.onboarding')}</CardTitle>
                </CardHeader>
                <CardBody>
                  <div style={OnboardingRow}>
                    <span style={OnboardingLabel}>{t('perfilMaster.labels.emailVerified')}</span>
                    {emailVerifiedBadge}
                  </div>
                  <div style={OnboardingRow}>
                    <span style={OnboardingLabel}>{t('perfilMaster.labels.kyc')}</span>
                    {kycStatusBadge}
                  </div>
                  <div style={OnboardingRowLast}>
                    <span style={OnboardingLabel}>{t('perfilMaster.labels.contract')}</span>
                    {contractBadge}
                  </div>
                </CardBody>
              </ProfileCard>

              <SecurityCard>
                <CardHeader>
                  <CardTitle>{t('perfilMaster.sections.security')}</CardTitle>
                </CardHeader>
                <CardBody>
                  <SecurityActions>
                    <ProfileSecondaryButton type="button" onClick={handleChangePassword}>
                      {t('perfilMaster.actions.changePassword')}
                    </ProfileSecondaryButton>
                  </SecurityActions>
                  <Hint>{t('perfilMaster.security.hint')}</Hint>
                </CardBody>
              </SecurityCard>
            </ProfileColSide>
          </ProfileGrid>
        )}
      </ProfileMain>
    </StyledContainer>
  );
}
