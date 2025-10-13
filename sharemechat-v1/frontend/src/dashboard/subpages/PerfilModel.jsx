// src/dashboard/subpages/PerfilModel.jsx
import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';

import {
  StyledContainer,
  StyledNavbar,
  StyledNavButton,
  StyledBrand
} from '../../styles/ModelStyles';

import {
  PageWrap,
  Title,
  Message,
  Form,
  FormRow,
  Label,
  Input,
  Textarea,
  ButtonPrimary,
  ButtonDangerOutline,
  ButtonRow,
  FileInput,
  FileLabel,
  Hr,
  SectionCard,
  SectionTitle,
  FileName,
  Photo,
  Hint,
  BackButton,
} from '../../styles/subpages/PerfilClientModelStyle.js';

import { Video } from '../../styles/subpages/PerfilModelStyles';

const DOCS_GET_URL    = '/api/models/documents/me';
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

  const [docs, setDocs] = useState({
    urlPic: null,
    urlVideo: null,
  });

  const [picFile, setPicFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [uploadingField, setUploadingField] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deletingVideo, setDeletingVideo] = useState(false);
  const [picKey, setPicKey] = useState(0);
  const [videoKey, setVideoKey] = useState(0);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, history]);

  const loadDocs = async () => {
    try {
      const res = await fetch(DOCS_GET_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setDocs({
        urlPic:   data.urlPic   || null,
        urlVideo: data.urlVideo || null,
      });
    } catch { /* noop */ }
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

      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'No se pudo guardar');
      }
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
        urlPic:   data.urlPic   || null,
        urlVideo: data.urlVideo || null,
      });

      if (fieldName === 'pic')   { setPicFile(null);   setPicKey(k => k + 1); }
      if (fieldName === 'video') { setVideoFile(null); setVideoKey(k => k + 1); }

      setMsg('Archivo subido correctamente.');
    } catch (e) {
      setError(e.message);
    } finally {
      setUploadingField(null);
    }
  };

  const deleteVideo = async () => {
    if (!docs.urlVideo) return;
    if (!window.confirm('¿Eliminar tu vídeo de presentación?')) return;
    setDeletingVideo(true);
    setError('');
    setMsg('');
    try {
      const res = await fetch(`${DOCS_UPLOAD_URL}?field=video`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.text()) || 'No se pudo eliminar el vídeo');
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

  const deletePhoto = async () => {
    if (!docs.urlPic) return;
    if (!window.confirm('¿Eliminar tu foto de perfil?')) return;
    setDeleting(true);
    setError('');
    setMsg('');
    try {
      const res = await fetch(`${DOCS_UPLOAD_URL}?field=pic`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.text()) || 'No se pudo eliminar la foto');
      setDocs((d) => ({ ...d, urlPic: null }));
      setPicFile(null);
      setPicKey(k => k + 1);
      setMsg('Foto eliminada.');
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <StyledContainer>
      <StyledNavbar>
        <StyledBrand href="/" aria-label="SharemeChat" />
        <div>
          <StyledNavButton type="button" onClick={onUnsubscribe}>
            Darme de baja
          </StyledNavButton>
          <StyledNavButton type="button" onClick={() => history.push('/change-password')}>
            Cambiar contraseña
          </StyledNavButton>
          <BackButton type="button" onClick={() => history.goBack()}>
            Volver
          </BackButton>
        </div>
      </StyledNavbar>

      <PageWrap>
        <Title>Perfil (Modelo)</Title>
        {loading && <p>Cargando…</p>}
        {error && <Message type="error">{error}</Message>}
        {msg && <Message type="ok">{msg}</Message>}

        {!loading && (
          <>
            {/* Datos básicos */}
            <Form onSubmit={(e) => e.preventDefault()}>
              <FormRow>
                <Label>Email (solo lectura)</Label>
                <Input type="email" value={form.email} readOnly />
              </FormRow>

              <FormRow>
                <Label>Nombre</Label>
                <Input name="name" value={form.name} onChange={onChange} placeholder="Tu nombre" />
              </FormRow>

              <FormRow>
                <Label>Apellido</Label>
                <Input name="surname" value={form.surname} onChange={onChange} placeholder="Tu apellido" />
              </FormRow>

              <FormRow>
                <Label>Nickname</Label>
                <Input name="nickname" value={form.nickname} onChange={onChange} placeholder="Tu nickname" />
              </FormRow>

              <FormRow>
                <Label>Biografía</Label>
                <Textarea
                  name="biography"
                  value={form.biography}
                  onChange={onChange}
                  placeholder="Cuéntanos sobre ti y tu estilo"
                  rows={4}
                />
              </FormRow>

              <FormRow>
                <Label>Intereses (separados por comas)</Label>
                <Input
                  name="interests"
                  value={form.interests}
                  onChange={onChange}
                  placeholder="gaming, cosplay, baile…"
                />
              </FormRow>

              <div>
                <ButtonPrimary type="button" onClick={handleSave} disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </ButtonPrimary>
              </div>
            </Form>

            <Hr />

            {/* Multimedia del perfil */}
            <SectionCard>
              <SectionTitle>Multimedia del perfil</SectionTitle>

              {/* Foto */}
              <SectionCard as="div">
                <h4>Foto de perfil (archivo)</h4>
                {docs.urlPic ? (
                  <>
                    <Photo src={docs.urlPic} alt="foto actual" />
                    <FileName>
                      <a href={docs.urlPic} target="_blank" rel="noreferrer">
                        {(() => {
                          const raw = (docs.urlPic || '').split('?')[0].split('#')[0].split('/').pop() || '';
                          const originalName = raw.replace(
                            /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-/,
                            ''
                          );
                          return decodeURIComponent(originalName);
                        })()}
                      </a>
                    </FileName>
                  </>
                ) : (
                  <Message $muted>— No subido —</Message>
                )}

                <ButtonRow>
                  <FileInput
                    key={picKey}
                    id="model-pic"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPicFile(e.target.files?.[0] || null)}
                  />
                  <FileLabel htmlFor="model-pic">Seleccionar archivo</FileLabel>

                  <ButtonPrimary
                    type="button"
                    onClick={() => uploadSingle('pic', picFile)}
                    disabled={!picFile || uploadingField === 'pic'}
                  >
                    {uploadingField === 'pic' ? 'Subiendo…' : 'Subir foto'}
                  </ButtonPrimary>

                  {docs.urlPic && (
                    <ButtonDangerOutline
                      type="button"
                      onClick={deletePhoto}
                      disabled={deleting}
                      title="Eliminar foto actual"
                    >
                      {deleting ? 'Eliminando…' : 'Eliminar foto'}
                    </ButtonDangerOutline>
                  )}
                </ButtonRow>

                <Hint>Formato recomendado JPG/PNG.</Hint>
              </SectionCard>

              {/* Vídeo */}
              <SectionCard as="div" style={{ marginTop: 16 }}>
                <h4>Vídeo de presentación</h4>
                {docs.urlVideo ? (
                  <>
                    <Video src={docs.urlVideo} controls />
                    <FileName>
                      <a href={docs.urlVideo} target="_blank" rel="noreferrer">
                        {(() => {
                          const raw = (docs.urlVideo || '').split('?')[0].split('#')[0].split('/').pop() || '';
                          const originalName = raw.replace(
                            /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-/,
                            ''
                          );
                          return decodeURIComponent(originalName);
                        })()}
                      </a>
                    </FileName>
                  </>
                ) : (
                  <Message $muted>— No subido —</Message>
                )}

                <ButtonRow>
                  <FileInput
                    key={videoKey}
                    id="model-video"
                    type="file"
                    accept="video/*"
                    onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                  />
                  <FileLabel htmlFor="model-video">Seleccionar archivo</FileLabel>

                  <ButtonPrimary
                    type="button"
                    onClick={() => uploadSingle('video', videoFile)}
                    disabled={!videoFile || uploadingField === 'video'}
                  >
                    {uploadingField === 'video' ? 'Subiendo…' : 'Subir vídeo'}
                  </ButtonPrimary>

                  {docs.urlVideo && (
                    <ButtonDangerOutline
                      type="button"
                      onClick={deleteVideo}
                      disabled={deletingVideo}
                      title="Eliminar vídeo actual"
                    >
                      {deletingVideo ? 'Eliminando…' : 'Eliminar vídeo'}
                    </ButtonDangerOutline>
                  )}
                </ButtonRow>

                <Hint>Formato recomendado MP4. Tamaño razonable para carga rápida.</Hint>
              </SectionCard>
            </SectionCard>
          </>
        )}
      </PageWrap>
    </StyledContainer>
  );
};

export default PerfilModel;
