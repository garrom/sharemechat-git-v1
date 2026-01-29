// src/pages/subpages/PerfilClient.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import { useSession } from '../../components/SessionProvider';
import { apiFetch } from '../../config/http';
import { useAppModals } from '../../components/useAppModals';

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
        setError(e.message || 'No se pudo cargar el perfil');
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

      setMsg('Datos guardados correctamente.');
    } catch (e) {
      setError(e.message || 'No se pudo guardar');
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
      setMsg('Foto subida correctamente.');
    } catch (e) {
      setError(e.message || 'No se pudo subir la foto');
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async () => {
    if (!docs.urlPic) return;
    if (!window.confirm('¿Eliminar tu foto de perfil?')) return;

    setDeleting(true);
    setError('');
    setMsg('');

    try {
      await apiFetch(`${DOCS_UPLOAD_URL}?field=pic`, {
        method: 'DELETE',
      });

      setDocs({ urlPic: null });
      setPicFile(null);
      setMsg('Foto eliminada.');
    } catch (e) {
      setError(e.message || 'No se pudo eliminar la foto');
    } finally {
      setDeleting(false);
    }
  };

  const displayName = form.nickname || form.name || form.email || 'Tu perfil';

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
              <ChipRole>Cliente</ChipRole>
            </ProfileHeaderTitleRow>
            <ProfileHeaderSubtitle>
              Gestiona tus datos personales y la foto que verán las modelos.
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
                    Estos datos no se muestran a otros usuarios salvo tu nickname.
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
                    Ayúdanos a encontrar mejores matches según tus gustos.
                  </CardSubtitle>
                </CardHeader>
                <CardBody>
                  <FormFieldNew>
                    <Label>Biografía</Label>
                    <Textarea
                      name="biography"
                      value={form.biography}
                      onChange={onChange}
                      placeholder="Cuéntanos algo sobre ti, qué buscas, etc."
                      rows={4}
                    />
                  </FormFieldNew>

                  <FormFieldNew>
                    <Label>Intereses</Label>
                    <Input
                      name="interests"
                      value={form.interests}
                      onChange={onChange}
                      placeholder="cine, música, viajes…"
                    />
                    <Hint>
                      Separa los intereses con comas. Los usamos para sugerir mejores modelos.
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

            {/* COLUMNA DERECHA: FOTO + SEGURIDAD */}
            <ProfileColSide>
              <MediaCard>
                <CardHeader>
                  <CardTitle>Foto de perfil</CardTitle>
                  <CardSubtitle>
                    Esta imagen se muestra a las modelos durante el videochat.
                  </CardSubtitle>
                </CardHeader>
                <CardBody>
                  {docs.urlPic ? (
                    <>
                      <PhotoPreview>
                        <PhotoImg src={docs.urlPic} alt="Foto de perfil actual" />
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
                    <PhotoEmpty>— Sin foto —</PhotoEmpty>
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
                      Seleccionar archivo
                    </ProfileSecondaryButton>

                    <ProfilePrimaryButton
                      type="button"
                      onClick={uploadPhoto}
                      disabled={!picFile || uploading}
                    >
                      {uploading ? 'Subiendo…' : 'Subir foto'}
                    </ProfilePrimaryButton>

                    {docs.urlPic && (
                      <ProfileDangerOutlineButton
                        type="button"
                        onClick={deletePhoto}
                        disabled={deleting}
                      >
                        {deleting ? 'Eliminando…' : 'Eliminar foto'}
                      </ProfileDangerOutlineButton>
                    )}
                  </PhotoActions>

                  <Hint>
                    Formato recomendado JPG/PNG. Se recortará automáticamente para verse bien en móvil.
                  </Hint>
                </CardBody>
              </MediaCard>

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

export default PerfilClient;
