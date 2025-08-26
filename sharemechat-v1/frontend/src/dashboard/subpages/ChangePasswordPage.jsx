import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';

const NavbarLite = ({ onBack }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 16px', borderBottom: '1px solid #eee', position: 'sticky', top: 0, background: '#fff', zIndex: 10
  }}>
    <div style={{ fontWeight: 700 }}>Mi Logo</div>
    <button onClick={onBack} style={{ padding: '8px 12px', cursor: 'pointer' }}>
      Volver
    </button>
  </div>
);

const checkStrength = (pwd) => {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score; // 0..5
};

const strengthLabel = (s) => {
  if (s <= 1) return 'Muy débil';
  if (s === 2) return 'Débil';
  if (s === 3) return 'Media';
  if (s === 4) return 'Fuerte';
  return 'Muy fuerte';
};

const ChangePasswordPage = () => {
  const history = useHistory();
  const token = localStorage.getItem('token');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const strength = checkStrength(newPassword);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setOkMsg('');

    if (!token) {
      setError('Sesión expirada. Inicia sesión de nuevo.');
      return;
    }
    if (!currentPassword || !newPassword || !repeatPassword) {
      setError('Completa todos los campos.');
      return;
    }
    if (newPassword !== repeatPassword) {
      setError('La nueva contraseña y su repetición no coinciden.');
      return;
    }
    if (newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const text = await res.text();
      if (!res.ok) {
        // Procura mostrar mensaje del backend si viene
        throw new Error(text || 'Error al cambiar la contraseña');
      }

      setOkMsg(text || 'Contraseña actualizada correctamente.');
      setCurrentPassword('');
      setNewPassword('');
      setRepeatPassword('');
      // Opcional: redirigir de vuelta tras 1.5s
      setTimeout(() => history.goBack(), 1500);
    } catch (err) {
      setError(err.message || 'Error al cambiar la contraseña');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      <NavbarLite onBack={() => history.goBack()} />

      <div style={{ maxWidth: 520, margin: '24px auto', padding: '0 16px' }}>
        <h2 style={{ marginBottom: 8 }}>Cambiar contraseña</h2>
        <p style={{ color: '#6c757d', marginTop: 0 }}>
          Por seguridad, vuelve a introducir tu contraseña actual.
        </p>

        <form onSubmit={handleSubmit} style={{
          background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: 16
        }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 6 }}>Contraseña actual</label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="Tu contraseña actual"
              autoComplete="current-password"
              style={{ width: '100%', padding: 10, border: '1px solid #ccc', borderRadius: 8 }}
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', marginBottom: 6 }}>Nueva contraseña</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Mín. 8 caracteres"
              autoComplete="new-password"
              style={{ width: '100%', padding: 10, border: '1px solid #ccc', borderRadius: 8 }}
            />
            <div style={{ marginTop: 6, fontSize: 12, color: '#6c757d' }}>
              Fortalece tu contraseña usando mayúsculas, minúsculas, números y símbolos.
            </div>

            {/* Indicador simple de fuerza */}
            <div style={{ marginTop: 8 }}>
              <div style={{ height: 8, background: '#eee', borderRadius: 999 }}>
                <div
                  style={{
                    height: 8,
                    width: `${(strength / 5) * 100}%`,
                    background: strength >= 4 ? '#28a745' : strength === 3 ? '#ffc107' : '#dc3545',
                    borderRadius: 999,
                    transition: 'width .2s ease'
                  }}
                />
              </div>
              <div style={{ fontSize: 12, marginTop: 6 }}>
                Fortaleza: <strong>{strengthLabel(strength)}</strong>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 6 }}>Repite la nueva contraseña</label>
            <input
              type="password"
              value={repeatPassword}
              onChange={e => setRepeatPassword(e.target.value)}
              placeholder="Vuelve a escribirla"
              autoComplete="new-password"
              style={{ width: '100%', padding: 10, border: '1px solid #ccc', borderRadius: 8 }}
            />
          </div>

          {error && <p style={{ color: 'red', marginTop: 4 }}>{error}</p>}
          {okMsg && <p style={{ color: 'green', marginTop: 4 }}>{okMsg}</p>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
            <button
              type="button"
              onClick={() => history.goBack()}
              style={{ padding: '10px 14px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{ padding: '10px 14px', background: '#007bff', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
            >
              {submitting ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
