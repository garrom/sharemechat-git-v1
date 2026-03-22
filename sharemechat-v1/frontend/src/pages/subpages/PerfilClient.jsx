// src/pages/subpages/PerfilClient.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import { useSession } from '../../components/SessionProvider';
import { apiFetch } from '../../config/http';
import { useAppModals } from '../../components/useAppModals';
import i18n from '../../i18n';

// Navbar unificado
import {
  StyledContainer,
  StyledNavbar,
  StyledBrand
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
  FileInput,
  Hint,
  FileNameWrapper,
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
  MediaCard,
  SecurityCard,
  CardHeader,
  CardTitle,
  CardSubtitle,
  CardBody,
  CardFooter,
  FormGridNew,
  FormFieldNew,
  PhotoPreview,
  PhotoImg,
  PhotoEmpty,
  PhotoActions,
  SecurityActions,
} from '../../styles/subpages/PerfilClientModelStyle';

const DOCS_GET_URL = '/clients/documents/me';
const DOCS_UPLOAD_URL = '/clients/documents';

const PerfilClient = () => {
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
    email: '', name: '', surname: '', nickname: '', biography: '', interests: '',
  });

  const [docs, setDocs] = useState({ urlPic: null });
  const [picFile, setPicFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const picInputRef = useRef(null);

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

        await loadDocs();
      } catch (e) {
        setError(e.message || t('profileCommon.errors.loadProfile'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [sessionUser, sessionLoading, history]);


  const loadDocs = async () => {
    try {
      const d = await apiFetch(DOCS_GET_URL);
      setDocs({ urlPic: d.urlPic || null });
    } catch {
      // noop
    }
  };

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
      setError(e.message || t('profileCommon.errors.save'));
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


  const uploadPhoto = async () => {
    if (!picFile) return;

    setUploading(true);
    setError('');
    setMsg('');

    try {
      const fd = new FormData();
      fd.append('pic', picFile);

      const data = await apiFetch(DOCS_UPLOAD_URL, {
        method: 'POST',
        body: fd,
      });

      setDocs({ urlPic: data.urlPic || null });
      setPicFile(null);
      setMsg(t('profileCommon.success.photoUploaded'));
    } catch (e) {
      setError(e.message || t('profileCommon.errors.uploadPhoto'));
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async () => {
    if (!docs.urlPic) return;
    if (!window.confirm(t('profileCommon.confirm.deletePhoto'))) return;

    setDeleting(true);
    setError('');
    setMsg('');

    try {
      await apiFetch(`${DOCS_UPLOAD_URL}?field=pic`, {
        method: 'DELETE',
      });

      setDocs({ urlPic: null });
      setPicFile(null);
      setMsg(t('profileCommon.success.photoDeleted'));
    } catch (e) {
      setError(e.message || t('profileCommon.errors.deletePhoto'));
    } finally {
      setDeleting(false);
    }
  };

  const displayName = form.nickname || form.name || form.email || t('perfilClient.displayName');

  const currentFileName = (() => {
    if (!docs.urlPic) return '';
    const raw = (docs.urlPic || '').split('?')[0].split('#')[0].split('/').pop() || '';
    const originalName = raw.replace(/^[0-9a-fA-F-]{36}-/, '');
    return decodeURIComponent(originalName);
  })();

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
              {docs.urlPic && (
                <AvatarImg src={docs.urlPic} alt={t('profileCommon.alt.profilePhoto')} />
              )}
            </Avatar>
          </ProfileHeaderAvatar>

          <ProfileHeaderInfo>
            <ProfileHeaderTitleRow>
              <ProfileHeaderName>{displayName}</ProfileHeaderName>
              <ChipRole>{t('perfilClient.role')}</ChipRole>
            </ProfileHeaderTitleRow>
            <ProfileHeaderSubtitle>
              {t('perfilClient.header.subtitle')}
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
            </ProfileHeaderMeta>
          </ProfileHeaderInfo>
        </ProfileHeader>

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
                    {t('perfilClient.sections.basicData.subtitle')}
                  </CardSubtitle>
                </CardHeader>
                <CardBody>
                  <FormGridNew>
                    <FormFieldNew>
                      <Label>{t('profileCommon.labels.email')}</Label>
                      <Input
                        type="email"
                        value={form.email}
                        readOnly
                      />
                    </FormFieldNew>

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
                    {t('perfilClient.sections.about.subtitle')}
                  </CardSubtitle>
                </CardHeader>
                <CardBody>
                  <FormFieldNew>
                    <Label>{t('profileCommon.labels.biography')}</Label>
                    <Textarea
                      name="biography"
                      value={form.biography}
                      onChange={onChange}
                      placeholder={t('perfilClient.placeholders.biography')}
                      rows={4}
                    />
                  </FormFieldNew>

                  <FormFieldNew>
                    <Label>{t('profileCommon.labels.interests')}</Label>
                    <Input
                      name="interests"
                      value={form.interests}
                      onChange={onChange}
                      placeholder={t('perfilClient.placeholders.interests')}
                    />
                    <Hint>
                      {t('perfilClient.hints.interests')}
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
            </ProfileColMain>

            {/* COLUMNA DERECHA: FOTO + SEGURIDAD */}
            <ProfileColSide>
              <MediaCard>
                <CardHeader>
                  <CardTitle>{t('profileCommon.sections.profilePhoto.title')}</CardTitle>
                  <CardSubtitle>
                    {t('perfilClient.sections.profilePhoto.subtitle')}
                  </CardSubtitle>
                </CardHeader>
                <CardBody>
                  {docs.urlPic ? (
                    <>
                      <PhotoPreview>
                        <PhotoImg src={docs.urlPic} alt={t('profileCommon.alt.currentProfilePhoto')} />
                      </PhotoPreview>
                      {currentFileName && (
                        <FileNameWrapper>
                          <a href={docs.urlPic} target="_blank" rel="noreferrer">
                            {currentFileName}
                          </a>
                        </FileNameWrapper>
                      )}
                    </>
                  ) : (
                    <PhotoEmpty>{t('profileCommon.empty.noPhoto')}</PhotoEmpty>
                  )}

                  <PhotoActions>
                    <FileInput
                      id="client-pic"
                      type="file"
                      accept="image/*"
                      ref={picInputRef}
                      onChange={(e) => setPicFile(e.target.files?.[0] || null)}
                    />
                    <ProfileSecondaryButton
                      type="button"
                      onClick={() => picInputRef.current && picInputRef.current.click()}
                    >
                      {t('profileCommon.actions.selectFile')}
                    </ProfileSecondaryButton>

                    <ProfilePrimaryButton
                      type="button"
                      onClick={uploadPhoto}
                      disabled={!picFile || uploading}
                    >
                      {uploading ? t('profileCommon.actions.uploading') : t('profileCommon.actions.uploadPhoto')}
                    </ProfilePrimaryButton>

                    {docs.urlPic && (
                      <ProfileDangerOutlineButton
                        type="button"
                        onClick={deletePhoto}
                        disabled={deleting}
                      >
                        {deleting ? t('profileCommon.actions.deleting') : t('profileCommon.actions.deletePhoto')}
                      </ProfileDangerOutlineButton>
                    )}
                  </PhotoActions>

                  <Hint>
                    {t('perfilClient.hints.photoFormat')}
                  </Hint>
                </CardBody>
              </MediaCard>

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

export default PerfilClient;
