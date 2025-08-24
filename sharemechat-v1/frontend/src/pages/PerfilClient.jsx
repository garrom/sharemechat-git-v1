import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  StyledContainer,
  StyledNavbar,
  StyledNavButton,
} from '../styles/ClientStyles';

const PerfilClient = () => {
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
    profilePic: '',
  });

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
          profilePic: data.profilePic || '',
        });
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
        profilePicture: form.profilePic || null,
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

  return (
    <StyledContainer>
      {/* Navbar minimalista */}
      <StyledNavbar>
        <span>Mi Logo</span>
        <div>
          <StyledNavButton type="button" onClick={() => history.push('/change-password')}>
            Cambiar contraseña
          </StyledNavButton>
          <StyledNavButton
            type="button"
            onClick={() => history.goBack()}
            style={{ marginLeft: 8 }}
          >
            Volver
          </StyledNavButton>
        </div>
      </StyledNavbar>

      {/* Contenido de perfil */}
      <div style={{ maxWidth: 640, margin: '24px auto', padding: '0 16px' }}>
        <h2>Perfil (Cliente)</h2>
        {loading && <p>Cargando…</p>}
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {msg && <p style={{ color: 'green' }}>{msg}</p>}

        {!loading && (
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
              <label>Foto (URL)</label>
              <input
                name="profilePic"
                value={form.profilePic}
                onChange={onChange}
                placeholder="https://..."
                style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 6 }}
              />
              {form.profilePic && (
                <div style={{ marginTop: 8 }}>
                  <img src={form.profilePic} alt="preview" style={{ maxWidth: 160, borderRadius: 8 }} />
                </div>
              )}
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
        )}
      </div>
    </StyledContainer>
  );
};

export default PerfilClient;
