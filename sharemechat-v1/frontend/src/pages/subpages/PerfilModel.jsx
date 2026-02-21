// src/pages/subpages/PerfilModel.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import { useAppModals } from '../../components/useAppModals';
import { useSession } from '../../components/SessionProvider';
import { apiFetch } from '../../config/http';

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
        setError(e?.message || 'No se pudo cargar el perfil');
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

      setMsg('Datos guardados correctamente.');
    } catch (e) {
      setError(e?.message || 'No se pudo guardar');
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
        title: 'Cuenta',
        message: 'Cuenta dada de baja.',
        variant: 'success',
        size: 'sm',
      });

      history.push('/login');
    } catch (e) {
      await alert({
        title: 'Cuenta',
        message: e?.message || 'No se pudo completar la baja.',
        variant: 'danger',
        size: 'sm',
      });
    }
  };

  const handleAcceptNewContract = async () => {
    const url = contractInfo?.currentUrl;

    const confirmed = window.confirm(
      'Se ha actualizado el contrato de modelo. Debes aceptar la nueva versión para seguir gestionando tu perfil de modelo.\n\n¿Deseas aceptarlo ahora?'
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
      setMsg('Contrato de modelo aceptado correctamente.');
    } catch (e) {
      setError(e?.message || 'No se pudo aceptar el contrato');
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
      setError('Debes aceptar la nueva versión del contrato de modelo antes de subir archivos.');
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

      setMsg('Archivo subido correctamente.');
    } catch (e) {
      setError(e?.message || 'No se pudo subir el archivo');

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
      setError('Debes aceptar la nueva versión del contrato de modelo antes de modificar archivos.');
      return;
    }

    if (!window.confirm('¿Eliminar tu foto de perfil?')) return;

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
      setMsg('Foto eliminada.');
    } catch (e) {
      setError(e?.message || 'No se pudo eliminar');
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
      setError('Debes aceptar la nueva versión del contrato de modelo antes de modificar archivos.');
      return;
    }

    if (!window.confirm('¿Eliminar tu vídeo de presentación?')) return;

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
      setMsg('Vídeo eliminado.');
    } catch (e) {
      setError(e?.message || 'No se pudo eliminar');
      if ((e?.message || '').toLowerCase().includes('contrato')) {
        loadContractStatus();
      }
    } finally {
      setDeletingVideo(false);
    }
  };

  const displayName = form.nickname || form.name || form.email || 'Tu perfil de modelo';

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
            Volver
          </NavButton>
        </div>
      </StyledNavbar>

      <ProfileMain>
        {/* CABECERA PERFIL */}
        <ProfileHeader>
          <ProfileHeaderAvatar>
            <Avatar>
              {docs.urlPic && (
                <AvatarImg src={docs.urlPic} alt="Foto de perfil" />
              )}
            </Avatar>
          </ProfileHeaderAvatar>

          <ProfileHeaderInfo>
            <ProfileHeaderTitleRow>
              <ProfileHeaderName>{displayName}</ProfileHeaderName>
              <ChipRole>Modelo</ChipRole>
            </ProfileHeaderTitleRow>
            <ProfileHeaderSubtitle>
              Completa tus datos y sube una foto y un vídeo de presentación para atraer más clientes.
            </ProfileHeaderSubtitle>
            <ProfileHeaderMeta>
              <MetaItem>
                <MetaLabel>Estado</MetaLabel>
                <MetaValueOk>Cuenta activa</MetaValueOk>
              </MetaItem>
              <MetaItem>
                <MetaLabel>Email</MetaLabel>
                <MetaValue>{form.email || '—'}</MetaValue>
              </MetaItem>
            </ProfileHeaderMeta>
          </ProfileHeaderInfo>
        </ProfileHeader>

        {/* Aviso contrato actualizado (solo cuando aplica) */}
        {!loading && contractBlocked && (
          <ProfileCard style={{ marginTop: '16px', border: '1px solid rgba(255, 160, 0, 0.35)' }}>
            <CardHeader>
              <CardTitle>Contrato de modelo actualizado</CardTitle>
              <CardSubtitle>
                Se ha publicado una nueva versión del contrato. Debes aceptarla para seguir gestionando tu foto y vídeo de perfil.
              </CardSubtitle>
            </CardHeader>
            <CardBody>
              {contractInfo?.currentVersion && (
                <Hint>
                  Versión vigente: <strong>{contractInfo.currentVersion}</strong>
                </Hint>
              )}

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                {contractInfo?.currentUrl && (
                  <ProfileSecondaryButton
                    type="button"
                    onClick={() => window.open(contractInfo.currentUrl, '_blank', 'noopener,noreferrer')}
                  >
                    Ver contrato
                  </ProfileSecondaryButton>
                )}

                <ProfilePrimaryButton
                  type="button"
                  onClick={handleAcceptNewContract}
                  disabled={contractAccepting || contractLoading}
                >
                  {contractAccepting ? 'Aceptando…' : 'Aceptar nueva versión'}
                </ProfilePrimaryButton>
              </div>
            </CardBody>
          </ProfileCard>
        )}

        {/* Mensajes de estado */}
        {loading && <p>Cargando…</p>}
        {error && <Message type="error">{error}</Message>}
        {msg && <Message type="ok">{msg}</Message>}

        {!loading && (
          <ProfileGrid>
            {/* COLUMNA IZQUIERDA: DATOS */}
            <ProfileColMain>
              <ProfileCard>
                <CardHeader>
                  <CardTitle>Datos básicos</CardTitle>
                  <CardSubtitle>
                    Estos datos no se muestran a los clientes salvo tu nickname.
                  </CardSubtitle>
                </CardHeader>
                <CardBody>
                  <FormGridNew>
                    <FormFieldNew>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={form.email}
                        readOnly
                      />
                    </FormFieldNew>

                    <FormFieldNew>
                      <Label>Nombre</Label>
                      <Input
                        name="name"
                        value={form.name}
                        onChange={onChange}
                        placeholder="Tu nombre"
                      />
                    </FormFieldNew>

                    <FormFieldNew>
                      <Label>Apellido</Label>
                      <Input
                        name="surname"
                        value={form.surname}
                        onChange={onChange}
                        placeholder="Tu apellido"
                      />
                    </FormFieldNew>

                    <FormFieldNew>
                      <Label>Nickname</Label>
                      <Input
                        name="nickname"
                        value={form.nickname}
                        onChange={onChange}
                        placeholder="Tu nickname público"
                      />
                    </FormFieldNew>
                  </FormGridNew>
                </CardBody>
              </ProfileCard>

              <ProfileCard style={{ marginTop: '16px' }}>
                <CardHeader>
                  <CardTitle>Sobre ti</CardTitle>
                  <CardSubtitle>
                    Cuéntanos tu estilo, qué ofreces y qué te gusta hacer en las sesiones.
                  </CardSubtitle>
                </CardHeader>
                <CardBody>
                  <FormFieldNew>
                    <Label>Biografía</Label>
                    <Textarea
                      name="biography"
                      value={form.biography}
                      onChange={onChange}
                      placeholder="Cuéntanos sobre ti y tu estilo"
                      rows={4}
                    />
                  </FormFieldNew>

                  <FormFieldNew>
                    <Label>Intereses</Label>
                    <Input
                      name="interests"
                      value={form.interests}
                      onChange={onChange}
                      placeholder="gaming, cosplay, baile…"
                    />
                    <Hint>
                      Separa los intereses con comas. Los usamos para sugerir mejores clientes.
                    </Hint>
                  </FormFieldNew>
                </CardBody>
                <CardFooter>
                  <ProfilePrimaryButton
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? 'Guardando…' : 'Guardar cambios'}
                  </ProfilePrimaryButton>
                </CardFooter>
              </ProfileCard>
            </ProfileColMain>

            {/* COLUMNA DERECHA: MULTIMEDIA + SEGURIDAD */}
            <ProfileColSide>
              {/* FOTO DE PERFIL */}
              <MediaCard>
                <CardHeader>
                  <CardTitle>Foto de perfil</CardTitle>
                  <CardSubtitle>
                    Esta imagen se usa como portada de tu perfil de modelo.
                  </CardSubtitle>
                </CardHeader>
                <CardBody>
                  {docs.urlPic ? (
                    <>
                      <PhotoPreview>
                        <PhotoImg src={docs.urlPic} alt="Foto de perfil actual" />
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
                    <PhotoEmpty>— No subido —</PhotoEmpty>
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
                      Seleccionar archivo
                    </ProfileSecondaryButton>

                    <ProfilePrimaryButton
                      type="button"
                      onClick={() => uploadSingle('pic', picFile)}
                      disabled={contractBlocked || !picFile || uploadingField === 'pic'}
                    >
                      {uploadingField === 'pic' ? 'Subiendo…' : 'Subir foto'}
                    </ProfilePrimaryButton>

                    {docs.urlPic && (
                      <ProfileDangerOutlineButton
                        type="button"
                        onClick={deletePhoto}
                        disabled={contractBlocked || deletingPic}
                      >
                        {deletingPic ? 'Eliminando…' : 'Eliminar foto'}
                      </ProfileDangerOutlineButton>
                    )}
                  </PhotoActions>

                  <Hint>
                    {contractBlocked
                      ? 'Debes aceptar la nueva versión del contrato para modificar tu foto.'
                      : 'Formato recomendado JPG/PNG.'}
                  </Hint>
                </CardBody>
              </MediaCard>

              {/* VÍDEO DE PRESENTACIÓN */}
              <MediaCard style={{ marginTop: '16px' }}>
                <CardHeader>
                  <CardTitle>Vídeo de presentación</CardTitle>
                  <CardSubtitle>
                    Un breve vídeo te ayuda a destacar y aumentar la conversión de clientes.
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
                    <PhotoEmpty>— No subido —</PhotoEmpty>
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
                      Seleccionar archivo
                    </ProfileSecondaryButton>

                    <ProfilePrimaryButton
                      type="button"
                      onClick={() => uploadSingle('video', videoFile)}
                      disabled={contractBlocked || !videoFile || uploadingField === 'video'}
                    >
                      {uploadingField === 'video' ? 'Subiendo…' : 'Subir vídeo'}
                    </ProfilePrimaryButton>

                    {docs.urlVideo && (
                      <ProfileDangerOutlineButton
                        type="button"
                        onClick={deleteVideo}
                        disabled={contractBlocked || deletingVideo}
                      >
                        {deletingVideo ? 'Eliminando…' : 'Eliminar vídeo'}
                      </ProfileDangerOutlineButton>
                    )}
                  </PhotoActions>

                  <Hint>
                    {contractBlocked
                      ? 'Debes aceptar la nueva versión del contrato para modificar tu vídeo.'
                      : 'Formato recomendado MP4. Tamaño razonable para carga rápida.'}
                  </Hint>
                </CardBody>
              </MediaCard>

              {/* SEGURIDAD Y CUENTA */}
              <SecurityCard style={{ marginTop: '16px' }}>
                <CardHeader>
                  <CardTitle>Seguridad y cuenta</CardTitle>
                </CardHeader>
                <CardBody>
                  <SecurityActions>
                    <ProfileSecondaryButton
                      type="button"
                      onClick={() => history.push('/change-password')}
                    >
                      Cambiar contraseña
                    </ProfileSecondaryButton>
                    <ProfileDangerOutlineButton
                      type="button"
                      onClick={onUnsubscribe}
                    >
                      Darme de baja
                    </ProfileDangerOutlineButton>
                  </SecurityActions>
                  <Hint>
                    Si te das de baja, perderás tu saldo y no podrás acceder al historial de chats.
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