// src/pages/subpages/PerfilModel.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useHistory } from 'react-router-dom';

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

const DOCS_GET_URL = '/api/models/documents/me';
const DOCS_UPLOAD_URL = '/api/models/documents';

const PerfilModel = () => {
  const history = useHistory();
  const token = localStorage.getItem('token');

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

  // refs para disparar el click del input oculto
  const picInputRef = useRef(null);
  const videoInputRef = useRef(null);

  const loadDocs = async () => {
    try {
      const res = await fetch(DOCS_GET_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setDocs({
        urlPic: data.urlPic || null,
        urlVideo: data.urlVideo || null,
      });
    } catch {
      // noop
    }
  };

  useEffect(() => {
    if (!token) {
      history.push('/login');
      return;
    }

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error((await res.text()) || 'No se pudo cargar el perfil');
        const data = await res.json();
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
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token, history]);

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
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.text()) || 'No se pudo guardar');
      setMsg('Datos guardados correctamente.');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const onUnsubscribe = async () => {
    const reason = window.prompt('Motivo de baja (opcional):') || null;
    if (!window.confirm('¿Seguro que deseas darte de baja? Perderás tu saldo.')) return;
    const res = await fetch('/api/users/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) {
      localStorage.removeItem('token');
      alert('Cuenta dada de baja.');
      history.push('/login');
    } else {
      alert((await res.text()) || 'No se pudo completar la baja.');
    }
  };

  const uploadSingle = async (fieldName, fileObj) => {
    if (!fileObj) return;
    setUploadingField(fieldName);
    setError('');
    setMsg('');
    try {
      const fd = new FormData();
      fd.append(fieldName, fileObj);
      const res = await fetch(DOCS_UPLOAD_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error((await res.text()) || 'No se pudo subir el archivo');
      const data = await res.json();
      setDocs({
        urlPic: data.urlPic || null,
        urlVideo: data.urlVideo || null,
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
      setError(e.message);
    } finally {
      setUploadingField(null);
    }
  };

  const deletePhoto = async () => {
    if (!docs.urlPic || !window.confirm('¿Eliminar tu foto de perfil?')) return;
    setDeletingPic(true);
    setError('');
    setMsg('');
    try {
      const res = await fetch(`${DOCS_UPLOAD_URL}?field=pic`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.text()) || 'No se pudo eliminar');
      setDocs((d) => ({ ...d, urlPic: null }));
      setPicFile(null);
      setPicKey((k) => k + 1);
      setMsg('Foto eliminada.');
    } catch (e) {
      setError(e.message);
    } finally {
      setDeletingPic(false);
    }
  };

  const deleteVideo = async () => {
    if (!docs.urlVideo || !window.confirm('¿Eliminar tu vídeo de presentación?')) return;
    setDeletingVideo(true);
    setError('');
    setMsg('');
    try {
      const res = await fetch(`${DOCS_UPLOAD_URL}?field=video`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.text()) || 'No se pudo eliminar');
      setDocs((d) => ({ ...d, urlVideo: null }));
      setVideoFile(null);
      setVideoKey((k) => k + 1);
      setMsg('Vídeo eliminado.');
    } catch (e) {
      setError(e.message);
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
                    >
                      Seleccionar archivo
                    </ProfileSecondaryButton>

                    <ProfilePrimaryButton
                      type="button"
                      onClick={() => uploadSingle('pic', picFile)}
                      disabled={!picFile || uploadingField === 'pic'}
                    >
                      {uploadingField === 'pic' ? 'Subiendo…' : 'Subir foto'}
                    </ProfilePrimaryButton>

                    {docs.urlPic && (
                      <ProfileDangerOutlineButton
                        type="button"
                        onClick={deletePhoto}
                        disabled={deletingPic}
                      >
                        {deletingPic ? 'Eliminando…' : 'Eliminar foto'}
                      </ProfileDangerOutlineButton>
                    )}
                  </PhotoActions>

                  <Hint>Formato recomendado JPG/PNG.</Hint>
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
                    >
                      Seleccionar archivo
                    </ProfileSecondaryButton>

                    <ProfilePrimaryButton
                      type="button"
                      onClick={() => uploadSingle('video', videoFile)}
                      disabled={!videoFile || uploadingField === 'video'}
                    >
                      {uploadingField === 'video' ? 'Subiendo…' : 'Subir vídeo'}
                    </ProfilePrimaryButton>

                    {docs.urlVideo && (
                      <ProfileDangerOutlineButton
                        type="button"
                        onClick={deleteVideo}
                        disabled={deletingVideo}
                      >
                        {deletingVideo ? 'Eliminando…' : 'Eliminar vídeo'}
                      </ProfileDangerOutlineButton>
                    )}
                  </PhotoActions>

                  <Hint>
                    Formato recomendado MP4. Tamaño razonable para carga rápida.
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
