// src/pages/subpages/PerfilModel.jsx
import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useAppModals } from '../../components/useAppModals';
import { useSession } from '../../components/SessionProvider';
import { apiFetch } from '../../config/http';
import i18n from '../../i18n';
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
  ProfileDangerOutlineButton,
} from '../../styles/ButtonStyles';

import {
  Message,
  Label,
  Input,
  Textarea,
  Hint,
  ProfileMain,
  ProfileHeader,
  ProfileHeaderAvatar,
  Avatar,
  AvatarImg,
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
  ContractNoticeCard,
  CardHeader,
  CardTitle,
  CardSubtitle,
  CardBody,
  CardFooter,
  FormGridNew,
  FormFieldNew,
  InlineActions,
  SecurityActions,
} from '../../styles/subpages/PerfilClientModelStyle';

import MyAssetsManager from './MyAssetsManager';

const PerfilModel = () => {
  const t = (key, options) => i18n.t(key, options);
  const history = useHistory();
  const { alert, openUnsubscribeModal } = useAppModals();
  const { user: sessionUser, loading: sessionLoading } = useSession();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [userId, setUserId] = useState(null);

  const [form, setForm] = useState({
    email: '',
    name: '',
    surname: '',
    nickname: '',
    biography: '',
    interests: '',
  });

  // Capa 2: avatar del header derivado del asset PIC principal APPROVED.
  // El MyAssetsManager nos lo entrega vía onAssetsChange en cada refresh.
  const [headerAvatarUrl, setHeaderAvatarUrl] = useState(null);

  // Contrato (solo UX de ROLE_MODEL)
  const [contractLoading, setContractLoading] = useState(false);
  const [contractAccepting, setContractAccepting] = useState(false);
  const [contractInfo, setContractInfo] = useState({
    accepted: true,
    acceptedCurrent: true,
    acceptedEver: false,
    needsReaccept: false,
    currentVersion: null,
    currentSha256: null,
    currentUrl: null,
  });

  const loadContractStatus = async () => {
    setContractLoading(true);
    try {
      const data = await apiFetch('/consent/model-contract/status');

      setContractInfo({
        accepted: !!data?.accepted,
        acceptedCurrent: !!data?.acceptedCurrent,
        acceptedEver: !!data?.acceptedEver,
        needsReaccept: !!data?.needsReaccept,
        currentVersion: data?.currentVersion || null,
        currentSha256: data?.currentSha256 || null,
        currentUrl: data?.currentUrl || null,
      });
    } catch {
      // Si falla, no rompemos perfil. Dejamos sin bloqueo UX extra.
      setContractInfo((prev) => ({
        ...prev,
        accepted: true,
        acceptedCurrent: true,
        needsReaccept: false,
      }));
    } finally {
      setContractLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionUser && !sessionLoading) {
      history.push('/login');
      return;
    }

    if (!sessionUser) return;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await apiFetch('/users/me');

        setUserId(data.id);

        setForm({
          email: data.email || '',
          name: data.name || '',
          surname: data.surname || '',
          nickname: data.nickname || '',
          biography: data.biography || '',
          interests: data.interests || '',
        });

        await loadContractStatus();
      } catch (e) {
        setError(e?.message || t('profileCommon.errors.loadProfile'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [sessionUser, sessionLoading, history]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSave = async () => {
    if (!userId) return;

    setSaving(true);
    setError('');
    setMsg('');

    try {
      const payload = {
        name: form.name || null,
        surname: form.surname || null,
        nickname: form.nickname || null,
        biography: form.biography || null,
        interests: form.interests || null,
      };

      await apiFetch(`/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setMsg(t('profileCommon.success.saved'));
    } catch (e) {
      setError(e?.message || t('profileCommon.errors.save'));
    } finally {
      setSaving(false);
    }
  };

  const onUnsubscribe = async () => {
    const { confirmed, reason } = await openUnsubscribeModal();
    if (!confirmed) return;

    try {
      await apiFetch('/users/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      await alert({
        title: t('profileCommon.accountTitle'),
        message: t('profileCommon.success.unsubscribed'),
        variant: 'success',
        size: 'sm',
      });

      history.push('/login');
    } catch (e) {
      await alert({
        title: t('profileCommon.accountTitle'),
        message: e?.message || t('profileCommon.errors.unsubscribe'),
        variant: 'danger',
        size: 'sm',
      });
    }
  };

  const handleAcceptNewContract = async () => {
    const url = contractInfo?.currentUrl;

    const confirmed = window.confirm(
      t('perfilModel.contract.confirmAccept')
    );

    if (!confirmed) return;

    setContractAccepting(true);
    setError('');
    setMsg('');

    try {
      await apiFetch('/consent/model-contract/accept', {
        method: 'POST',
      });

      await loadContractStatus();
      setMsg(t('perfilModel.contract.success.accepted'));
    } catch (e) {
      setError(e?.message || t('perfilModel.contract.errors.accept'));
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } finally {
      setContractAccepting(false);
    }
  };

  // Callback que MyAssetsManager invoca tras cada carga/cambio.
  // El avatar del header es la URL del asset PIC principal APPROVED.
  const onAssetsChange = (assets) => {
    if (!Array.isArray(assets)) {
      setHeaderAvatarUrl(null);
      return;
    }
    const principalPic = assets.find(
      (a) =>
        a.assetType === 'PIC'
        && a.isPrincipal === true
        && a.isActive === true
        && a.reviewStatus === 'APPROVED'
    );
    setHeaderAvatarUrl(principalPic?.url || null);
  };

  const displayName = form.nickname || form.name || form.email || t('perfilModel.displayName');
  const contractBlocked = contractInfo?.acceptedCurrent === false;

  return (
    <StyledContainer>
      <StyledNavbar>
        <StyledBrand href="/" aria-label="SharemeChat" />
        <div>
          <NavButton type="button" onClick={() => history.goBack()}>
            {t('common.back')}
          </NavButton>
        </div>
      </StyledNavbar>

      <ProfileMain>
        {/* CABECERA PERFIL */}
        <ProfileHeader>
          <ProfileHeaderAvatar>
            <Avatar>
              {headerAvatarUrl && (
                <AvatarImg src={headerAvatarUrl} alt={t('profileCommon.alt.profilePhoto')} />
              )}
            </Avatar>
          </ProfileHeaderAvatar>

          <ProfileHeaderInfo>
            <ProfileHeaderTitleRow>
              <ProfileHeaderName>{displayName}</ProfileHeaderName>
              <ChipRole>{t('perfilModel.role')}</ChipRole>
            </ProfileHeaderTitleRow>
            <ProfileHeaderSubtitle>
              {t('perfilModel.header.subtitle')}
            </ProfileHeaderSubtitle>
            <ProfileHeaderMeta>
              <MetaItem>
                <MetaLabel>{t('profileCommon.labels.status')}</MetaLabel>
                <MetaValueOk>{t('profileCommon.status.active')}</MetaValueOk>
              </MetaItem>
              <MetaItem>
                <MetaLabel>{t('profileCommon.labels.email')}</MetaLabel>
                <MetaValue>{form.email || t('profileCommon.empty.value')}</MetaValue>
              </MetaItem>
              <MetaItem>
                <MetaLabel>{t('profileCommon.labels.language')}</MetaLabel>
                <LocaleSwitcher />
              </MetaItem>
            </ProfileHeaderMeta>
          </ProfileHeaderInfo>
        </ProfileHeader>

        {/* Aviso contrato actualizado (solo cuando aplica) */}
        {!loading && contractBlocked && (
          <ContractNoticeCard>
            <CardHeader>
              <CardTitle>{t('perfilModel.contract.title')}</CardTitle>
              <CardSubtitle>
                {t('perfilModel.contract.subtitle')}
              </CardSubtitle>
            </CardHeader>
            <CardBody>
              {contractInfo?.currentVersion && (
                <Hint>
                  {t('perfilModel.contract.currentVersion')} <strong>{contractInfo.currentVersion}</strong>
                </Hint>
              )}

              <InlineActions>
                {contractInfo?.currentUrl && (
                  <ProfileSecondaryButton
                    type="button"
                    onClick={() => window.open(contractInfo.currentUrl, '_blank', 'noopener,noreferrer')}
                  >
                    {t('perfilModel.contract.actions.viewContract')}
                  </ProfileSecondaryButton>
                )}

                <ProfilePrimaryButton
                  type="button"
                  onClick={handleAcceptNewContract}
                  disabled={contractAccepting || contractLoading}
                >
                  {contractAccepting ? t('perfilModel.contract.actions.accepting') : t('perfilModel.contract.actions.acceptNewVersion')}
                </ProfilePrimaryButton>
              </InlineActions>
            </CardBody>
          </ContractNoticeCard>
        )}

        {/* Mensajes de estado */}
        {loading && <p>{t('profileCommon.loading.default')}</p>}
        {error && <Message type="error">{error}</Message>}
        {msg && <Message type="ok">{msg}</Message>}

        {!loading && (
          <ProfileGrid>
            {/* COLUMNA IZQUIERDA: DATOS */}
            <ProfileColMain>
              <ProfileCard>
                <CardHeader>
                  <CardTitle>{t('profileCommon.sections.basicData.title')}</CardTitle>
                  <CardSubtitle>
                    {t('perfilModel.sections.basicData.subtitle')}
                  </CardSubtitle>
                </CardHeader>
                <CardBody>
                  <FormGridNew>
                    <FormFieldNew>
                      <Label>{t('profileCommon.labels.name')}</Label>
                      <Input
                        name="name"
                        value={form.name}
                        onChange={onChange}
                        placeholder={t('profileCommon.placeholders.name')}
                      />
                    </FormFieldNew>

                    <FormFieldNew>
                      <Label>{t('profileCommon.labels.surname')}</Label>
                      <Input
                        name="surname"
                        value={form.surname}
                        onChange={onChange}
                        placeholder={t('profileCommon.placeholders.surname')}
                      />
                    </FormFieldNew>

                    <FormFieldNew>
                      <Label>{t('profileCommon.labels.nickname')}</Label>
                      <Input
                        name="nickname"
                        value={form.nickname}
                        onChange={onChange}
                        placeholder={t('profileCommon.placeholders.nickname')}
                      />
                    </FormFieldNew>
                  </FormGridNew>
                </CardBody>
              </ProfileCard>

              <ProfileCard>
                <CardHeader>
                  <CardTitle>{t('profileCommon.sections.about.title')}</CardTitle>
                  <CardSubtitle>
                    {t('perfilModel.sections.about.subtitle')}
                  </CardSubtitle>
                </CardHeader>
                <CardBody>
                  <FormFieldNew>
                    <Label>{t('profileCommon.labels.biography')}</Label>
                    <Textarea
                      name="biography"
                      value={form.biography}
                      onChange={onChange}
                      placeholder={t('perfilModel.placeholders.biography')}
                      rows={4}
                    />
                  </FormFieldNew>

                  <FormFieldNew>
                    <Label>{t('profileCommon.labels.interests')}</Label>
                    <Input
                      name="interests"
                      value={form.interests}
                      onChange={onChange}
                      placeholder={t('perfilModel.placeholders.interests')}
                    />
                    <Hint>
                      {t('perfilModel.hints.interests')}
                    </Hint>
                  </FormFieldNew>
                </CardBody>
                <CardFooter>
                  <ProfilePrimaryButton
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? t('profileCommon.actions.saving') : t('profileCommon.actions.saveChanges')}
                  </ProfilePrimaryButton>
                </CardFooter>
              </ProfileCard>

              {/* GESTOR MULTI-ASSET (Capa 2) — reemplaza las 2 MediaCard antiguas */}
              <MyAssetsManager
                contractBlocked={contractBlocked}
                onAssetsChange={onAssetsChange}
              />
            </ProfileColMain>

            {/* COLUMNA DERECHA: SEGURIDAD Y CUENTA */}
            <ProfileColSide>
              <SecurityCard>
                <CardHeader>
                  <CardTitle>{t('profileCommon.sections.security.title')}</CardTitle>
                </CardHeader>
                <CardBody>
                  <SecurityActions>
                    <ProfileSecondaryButton
                      type="button"
                      onClick={() => history.push('/change-password')}
                    >
                      {t('profileCommon.actions.changePassword')}
                    </ProfileSecondaryButton>
                    <ProfileDangerOutlineButton
                      type="button"
                      onClick={onUnsubscribe}
                    >
                      {t('modals.unsubscribe.title')}
                    </ProfileDangerOutlineButton>
                  </SecurityActions>
                  <Hint>
                    {t('modals.unsubscribe.warning')}
                  </Hint>
                </CardBody>
              </SecurityCard>
            </ProfileColSide>
          </ProfileGrid>
        )}
      </ProfileMain>
    </StyledContainer>
  );
};

export default PerfilModel;
