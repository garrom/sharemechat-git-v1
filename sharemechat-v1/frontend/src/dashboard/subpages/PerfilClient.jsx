// src/dashboard/subpages/PerfilClient.jsx
import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';

// Reusables actuales (mantén los que ya usas)
import {
  StyledContainer,
  StyledNavbar,
  StyledNavButton,
} from '../../styles/ClientStyles';

// Estilos específicos de la página
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
  Hr,
  SectionCard,
  SectionTitle,
  PhotoBlock,
  Photo,
  FileInput,
  FileLabel,
  ButtonRow,
  ButtonDangerOutline,
  Hint,
  BackButton,
} from '../../styles/pages/PerfilClientModelStyle.js';

const DOCS_GET_URL    = '/api/clients/documents/me';
const DOCS_UPLOAD_URL = '/api/clients/documents'; // POST subir, DELETE eliminar ?field=pic

const PerfilClient = () => {
  const history = useHistory();
  const token = localStorage.getItem('token');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [msg, setMsg]         = useState('');
  const [userId, setUserId]   = useState(null);

  const [form, setForm] = useState({
    email: '',
    name: '',
    surname: '',
    nickname: '',
    biography: '',
    interests: '',
  });

  const [docs, setDocs] = useState({ urlPic: null });

  const [picFile, setPicFile]   = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting]   = useState(false);

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
      const r = await fetch(DOCS_GET_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const d = await r.json();
      setDocs({ urlPic: d.urlPic || null });
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

  const uploadPhoto = async () => {
    if (!picFile) return;
    setUploading(true);
    setError('');
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('pic', picFile);
      const res = await fetch(DOCS_UPLOAD_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error((await res.text()) || 'No se pudo subir la foto');
      const data = await res.json();
      setDocs({ urlPic: data.urlPic || null });
      setPicFile(null);
      setMsg('Foto subida correctamente.');
    } catch (e) {
      setError(e.message);
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
      const res = await fetch(`${DOCS_UPLOAD_URL}?field=pic`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.text()) || 'No se pudo eliminar la foto');
      setDocs({ urlPic: null });
      setPicFile(null);
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
        <span>Mi Logo</span>
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
        <Title>Perfil (Cliente)</Title>
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
                  placeholder="Cuéntanos sobre ti"
                  rows={4}
                />
              </FormRow>

              <FormRow>
                <Label>Intereses (separados por comas)</Label>
                <Input
                  name="interests"
                  value={form.interests}
                  onChange={onChange}
                  placeholder="cine, música, viajes…"
                />
              </FormRow>

              <div>
                <ButtonPrimary type="button" onClick={handleSave} disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </ButtonPrimary>
              </div>
            </Form>

            <Hr />

            {/* Foto de perfil */}
            <SectionCard>
              <SectionTitle>Foto de perfil</SectionTitle>

              <PhotoBlock>
                {docs.urlPic ? (
                  <div>
                    <Photo src={docs.urlPic} alt="foto actual" />
                    <div style={{ marginTop: 6 }}>
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
                    </div>
                  </div>
                ) : (
                  <Message $muted>— Sin foto —</Message>
                )}
              </PhotoBlock>

              <ButtonRow>
                <FileInput
                  id="client-pic"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPicFile(e.target.files?.[0] || null)}
                />
                <FileLabel htmlFor="client-pic">Seleccionar archivo</FileLabel>

                <ButtonPrimary type="button" onClick={uploadPhoto} disabled={!picFile || uploading}>
                  {uploading ? 'Subiendo…' : 'Subir foto'}
                </ButtonPrimary>

                {docs.urlPic && (
                  <ButtonDangerOutline type="button" onClick={deletePhoto} disabled={deleting} title="Eliminar foto actual">
                    {deleting ? 'Eliminando…' : 'Eliminar foto'}
                  </ButtonDangerOutline>
                )}
              </ButtonRow>

              <Hint>Formato recomendado JPG/PNG. Elige un archivo y pulsa “Subir foto”.</Hint>
            </SectionCard>
          </>
        )}
      </PageWrap>
    </StyledContainer>
  );
};

export default PerfilClient;
