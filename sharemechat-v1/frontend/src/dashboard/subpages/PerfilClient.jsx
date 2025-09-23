// PerfilClient.jsx
import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  StyledContainer,
  StyledNavbar,
  StyledNavButton,
} from '../../styles/ClientStyles';

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
          <StyledNavButton type="button" onClick={() => history.goBack()} style={{ marginLeft: 8 }}>
            Volver
          </StyledNavButton>
        </div>
      </StyledNavbar>

     <div style={{ maxWidth: 720, margin: '24px auto', padding: '0 16px' }}>
        <h2>Perfil (Cliente)</h2>
        {loading && <p>Cargando…</p>}
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {msg && <p style={{ color: 'green' }}>{msg}</p>}

        {!loading && (
          <>
            {/* Datos básicos */}
            <form onSubmit={(e) => e.preventDefault()}>
              <div style={{ marginBottom: 12 }}>
                <label>Email (solo lectura)</label>
                <input
                  type="email"
                  value={form.email}
                  readOnly
                  style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 6 }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label>Nombre</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={onChange}
                  placeholder="Tu nombre"
                  style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 6 }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label>Apellido</label>
                <input
                  name="surname"
                  value={form.surname}
                  onChange={onChange}
                  placeholder="Tu apellido"
                  style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 6 }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label>Nickname</label>
                <input
                  name="nickname"
                  value={form.nickname}
                  onChange={onChange}
                  placeholder="Tu nickname"
                  style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 6 }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label>Biografía</label>
                <textarea
                  name="biography"
                  value={form.biography}
                  onChange={onChange}
                  placeholder="Cuéntanos sobre ti"
                  rows={4}
                  style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 6, resize: 'vertical' }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label>Intereses (separados por comas)</label>
                <input
                  name="interests"
                  value={form.interests}
                  onChange={onChange}
                  placeholder="cine, música, viajes…"
                  style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 6 }}
                />
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{ padding: '10px 16px', cursor: 'pointer' }}
              >
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </form>

            <hr style={{ margin: '24px 0' }} />

            {/* Foto de perfil */}
            <section>
              <h3 style={{ marginBottom: 12 }}>Foto de perfil</h3>

              <div style={{ border: '1px solid #e5e5e5', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ marginBottom: 12 }}>
                  {docs.urlPic ? (
                    <div>
                      <img src={docs.urlPic} alt="foto actual" style={{ maxWidth: 220, borderRadius: 8 }} />
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
                    <p style={{ color: '#777', margin: 0 }}>— Sin foto —</p>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    id="client-pic"
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => setPicFile(e.target.files?.[0] || null)}
                  />
                  <label
                    htmlFor="client-pic"
                    style={{
                      display: 'inline-block',
                      padding: '8px 12px',
                      border: '1px solid #ced4da',
                      borderRadius: 6,
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    Seleccionar archivo
                  </label>

                  <button
                    type="button"
                    onClick={uploadPhoto}
                    disabled={!picFile || uploading}
                    style={{ padding: '8px 12px', cursor: 'pointer' }}
                  >
                    {uploading ? 'Subiendo…' : 'Subir foto'}
                  </button>

                  {docs.urlPic && (
                    <button
                      type="button"
                      onClick={deletePhoto}
                      disabled={deleting}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        border: '1px solid #dc3545',
                        background: 'white',
                        color: '#dc3545',
                        borderRadius: 6,
                      }}
                      title="Eliminar foto actual"
                    >
                      {deleting ? 'Eliminando…' : 'Eliminar foto'}
                    </button>
                  )}
                </div>

                <p style={{ marginTop: 8, color: '#6c757d' }}>
                  Formato recomendado JPG/PNG. Elige un archivo y pulsa “Subir foto”.
                </p>
              </div>
            </section>
          </>
        )}
      </div>
    </StyledContainer>
  );
};

export default PerfilClient;
