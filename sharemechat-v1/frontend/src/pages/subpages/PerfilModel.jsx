// src/pages/subpages/PerfilModel.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import { useAppModals } from '../../components/useAppModals';
import { useSession } from '../../components/SessionProvider';
import { apiFetch } from '../../config/http';
import i18n from '../../i18n';

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
  FileInput,
  Hint,
  FileNameWrapper,
  Video,
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

const DOCS_GET_URL = '/models/documents/me';
const DOCS_UPLOAD_URL = '/models/documents';

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

  const [docs, setDocs] = useState({ urlPic: null, urlVideo: null });
  const [picFile, setPicFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [uploadingField, setUploadingField] = useState(null);
  const [deletingPic, setDeletingPic] = useState(false);
  const [deletingVideo, setDeletingVideo] = useState(false);
  const [picKey, setPicKey] = useState(0);
  const [videoKey, setVideoKey] = useState(0);

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

  // refs para disparar el click del input oculto
  const picInputRef = useRef(null);
  const videoInputRef = useRef(null);

  const loadDocs = async () => {
    try {
      const data = await apiFetch(DOCS_GET_URL);
      setDocs({
        urlPic: data?.urlPic || null,
        urlVideo: data?.urlVideo || null,
      });
    } catch {
      // noop
    }
  };

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

        await Promise.all([
          loadDocs(),
          loadContractStatus(),
        ]);
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
        // El contrato se puede abrir igualmente
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } finally {
      setContractAccepting(false);
    }
  };

  const uploadSingle = async (fieldName, fileObj) => {
    if (!fileObj) return;

    if (contractInfo?.needsReaccept) {
      setError(t('perfilModel.contract.errors.acceptBeforeUpload'));
      return;
    }

    setUploadingField(fieldName);
    setError('');
    setMsg('');

    try {
      const fd = new FormData();
      fd.append(fieldName, fileObj);

      const data = await apiFetch(DOCS_UPLOAD_URL, {
        method: 'POST',
        body: fd,
      });

      setDocs({
        urlPic: data?.urlPic || null,
        urlVideo: data?.urlVideo || null,
      });

      if (fieldName === 'pic') {
        setPicFile(null);
        setPicKey((k) => k + 1);
      }
      if (fieldName === 'video') {
        setVideoFile(null);
        setVideoKey((k) => k + 1);
      }

      setMsg(t('perfilModel.media.success.fileUploaded'));
    } catch (e) {
      setError(e?.message || t('perfilModel.media.errors.uploadFile'));

      // Si backend devuelve mensaje de contrato, refrescamos estado para actualizar UX
      if ((e?.message || '').toLowerCase().includes('contrato')) {
        loadContractStatus();
      }
    } finally {
      setUploadingField(null);
    }
  };

  const deletePhoto = async () => {
    if (!docs.urlPic) return;

    if (contractInfo?.needsReaccept) {
      setError(t('perfilModel.contract.errors.acceptBeforeEditFiles'));
      return;
    }

    if (!window.confirm(t('profileCommon.confirm.deletePhoto'))) return;

    setDeletingPic(true);
    setError('');
    setMsg('');

    try {
      await apiFetch(`${DOCS_UPLOAD_URL}?field=pic`, {
        method: 'DELETE',
      });

      setDocs((d) => ({ ...d, urlPic: null }));
      setPicFile(null);
      setPicKey((k) => k + 1);
      setMsg(t('profileCommon.success.photoDeleted'));
    } catch (e) {
      setError(e?.message || t('perfilModel.media.errors.deleteFile'));
      if ((e?.message || '').toLowerCase().includes('contrato')) {
        loadContractStatus();
      }
    } finally {
      setDeletingPic(false);
    }
  };

  const deleteVideo = async () => {
    if (!docs.urlVideo) return;

    if (contractInfo?.needsReaccept) {
      setError(t('perfilModel.contract.errors.acceptBeforeEditFiles'));
      return;
    }

    if (!window.confirm(t('perfilModel.confirm.deleteIntroVideo'))) return;

    setDeletingVideo(true);
    setError('');
    setMsg('');

    try {
      await apiFetch(`${DOCS_UPLOAD_URL}?field=video`, {
        method: 'DELETE',
      });

      setDocs((d) => ({ ...d, urlVideo: null }));
      setVideoFile(null);
      setVideoKey((k) => k + 1);
      setMsg(t('perfilModel.media.success.videoDeleted'));
    } catch (e) {
      setError(e?.message || t('perfilModel.media.errors.deleteFile'));
      if ((e?.message || '').toLowerCase().includes('contrato')) {
        loadContractStatus();
      }
    } finally {
      setDeletingVideo(false);
    }
  };

  const displayName = form.nickname || form.name || form.email || t('perfilModel.displayName');

  const currentPicName = (() => {
    if (!docs.urlPic) return '';
    const raw = (docs.urlPic || '').split('?')[0].split('#')[0].split('/').pop() || '';
    const originalName = raw.replace(/^[0-9a-fA-F-]{36}-/, '');
    return decodeURIComponent(originalName);
  })();

  const currentVideoName = (() => {
    if (!docs.urlVideo) return '';
    const raw = (docs.urlVideo || '').split('?')[0].split('#')[0].split('/').pop() || '';
    const originalName = raw.replace(/^[0-9a-fA-F-]{36}-/, '');
    return decodeURIComponent(originalName);
  })();

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
              {docs.urlPic && (
                <AvatarImg src={docs.urlPic} alt={t('profileCommon.alt.profilePhoto')} />
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
            </ProfileHeaderMeta>
          </ProfileHeaderInfo>
        </ProfileHeader>

        {/* Aviso contrato actualizado (solo cuando aplica) */}
        {!loading && contractBlocked && (
          <ProfileCard style={{ marginTop: '16px', border: '1px solid rgba(255, 160, 0, 0.35)' }}>
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

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
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
              </div>
            </CardBody>
          </ProfileCard>
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

              <ProfileCard style={{ marginTop: '16px' }}>
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
            </ProfileColMain>

            {/* COLUMNA DERECHA: MULTIMEDIA + SEGURIDAD */}
            <ProfileColSide>
              {/* FOTO DE PERFIL */}
              <MediaCard>
                <CardHeader>
                  <CardTitle>{t('profileCommon.sections.profilePhoto.title')}</CardTitle>
                  <CardSubtitle>
                    {t('perfilModel.sections.profilePhoto.subtitle')}
                  </CardSubtitle>
                </CardHeader>
                <CardBody>
                  {docs.urlPic ? (
                    <>
                      <PhotoPreview>
                        <PhotoImg src={docs.urlPic} alt={t('profileCommon.alt.currentProfilePhoto')} />
                      </PhotoPreview>
                      {currentPicName && (
                        <FileNameWrapper>
                          <a href={docs.urlPic} target="_blank" rel="noreferrer">
                            {currentPicName}
                          </a>
                        </FileNameWrapper>
                      )}
                    </>
                  ) : (
                    <PhotoEmpty>{t('perfilModel.empty.notUploaded')}</PhotoEmpty>
                  )}

                  <PhotoActions>
                    <FileInput
                      key={picKey}
                      id="model-pic"
                      type="file"
                      accept="image/*"
                      ref={picInputRef}
                      onChange={(e) => setPicFile(e.target.files?.[0] || null)}
                    />

                    <ProfileSecondaryButton
                      type="button"
                      onClick={() => picInputRef.current && picInputRef.current.click()}
                      disabled={contractBlocked}
                    >
                      {t('profileCommon.actions.selectFile')}
                    </ProfileSecondaryButton>

                    <ProfilePrimaryButton
                      type="button"
                      onClick={() => uploadSingle('pic', picFile)}
                      disabled={contractBlocked || !picFile || uploadingField === 'pic'}
                    >
                      {uploadingField === 'pic' ? t('profileCommon.actions.uploading') : t('profileCommon.actions.uploadPhoto')}
                    </ProfilePrimaryButton>

                    {docs.urlPic && (
                      <ProfileDangerOutlineButton
                        type="button"
                        onClick={deletePhoto}
                        disabled={contractBlocked || deletingPic}
                      >
                        {deletingPic ? t('profileCommon.actions.deleting') : t('profileCommon.actions.deletePhoto')}
                      </ProfileDangerOutlineButton>
                    )}
                  </PhotoActions>

                  <Hint>
                    {contractBlocked
                      ? t('perfilModel.hints.acceptContractForPhoto')
                      : t('perfilModel.hints.photoFormat')}
                  </Hint>
                </CardBody>
              </MediaCard>

              {/* VÍDEO DE PRESENTACIÓN */}
              <MediaCard style={{ marginTop: '16px' }}>
                <CardHeader>
                  <CardTitle>{t('perfilModel.sections.introVideo.title')}</CardTitle>
                  <CardSubtitle>
                    {t('perfilModel.sections.introVideo.subtitle')}
                  </CardSubtitle>
                </CardHeader>
                <CardBody>
                  {docs.urlVideo ? (
                    <>
                      <Video src={docs.urlVideo} controls />
                      {currentVideoName && (
                        <FileNameWrapper>
                          <a href={docs.urlVideo} target="_blank" rel="noreferrer">
                            {currentVideoName}
                          </a>
                        </FileNameWrapper>
                      )}
                    </>
                  ) : (
                    <PhotoEmpty>{t('perfilModel.empty.notUploaded')}</PhotoEmpty>
                  )}

                  <PhotoActions>
                    <FileInput
                      key={videoKey}
                      id="model-video"
                      type="file"
                      accept="video/*"
                      ref={videoInputRef}
                      onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                    />

                    <ProfileSecondaryButton
                      type="button"
                      onClick={() => videoInputRef.current && videoInputRef.current.click()}
                      disabled={contractBlocked}
                    >
                      {t('profileCommon.actions.selectFile')}
                    </ProfileSecondaryButton>

                    <ProfilePrimaryButton
                      type="button"
                      onClick={() => uploadSingle('video', videoFile)}
                      disabled={contractBlocked || !videoFile || uploadingField === 'video'}
                    >
                      {uploadingField === 'video' ? t('profileCommon.actions.uploading') : t('perfilModel.actions.uploadVideo')}
                    </ProfilePrimaryButton>

                    {docs.urlVideo && (
                      <ProfileDangerOutlineButton
                        type="button"
                        onClick={deleteVideo}
                        disabled={contractBlocked || deletingVideo}
                      >
                        {deletingVideo ? t('profileCommon.actions.deleting') : t('perfilModel.actions.deleteVideo')}
                      </ProfileDangerOutlineButton>
                    )}
                  </PhotoActions>

                  <Hint>
                    {contractBlocked
                      ? t('perfilModel.hints.acceptContractForVideo')
                      : t('perfilModel.hints.videoFormat')}
                  </Hint>
                </CardBody>
              </MediaCard>

              {/* SEGURIDAD Y CUENTA */}
              <SecurityCard style={{ marginTop: '16px' }}>
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
