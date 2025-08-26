import React, { useMemo, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';

const box = {
  maxWidth: 400,
  margin: '40px auto',
  padding: 20,
  border: '1px solid #eee',
  borderRadius: 8,
  boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
};

const ResetPassword = () => {
  const history = useHistory();
  const location = useLocation();
  const token = useMemo(() => new URLSearchParams(location.search).get('token') || '', [location.search]);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState({ loading: false, ok: '', err: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      setStatus({ loading: false, ok: '', err: 'La contraseña debe tener al menos 8 caracteres.' });
      return;
    }
    if (password !== confirm) {
      setStatus({ loading: false, ok: '', err: 'Las contraseñas no coinciden.' });
      return;
    }
    if (!token) {
      setStatus({ loading: false, ok: '', err: 'Token no encontrado en el enlace.' });
      return;
    }

    setStatus({ loading: true, ok: '', err: '' });
    try {
      const res = await fetch('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const text = await res.text();
      if (!res.ok) {
        setStatus({ loading: false, ok: '', err: text || 'No se pudo restablecer la contraseña.' });
        return;
      }
      setStatus({ loading: false, ok: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.', err: '' });
    } catch (err) {
      setStatus({ loading: false, ok: '', err: 'Error de conexión. Inténtalo de nuevo.' });
    }
  };

  return (
    <div style={box}>
      <h2>Establecer nueva contraseña</h2>
      {!token && <div style={{ color: 'red', marginBottom: 10 }}>Token ausente o inválido.</div>}
      {status.ok && <div style={{ color: 'green', marginBottom: 10 }}>{status.ok}</div>}
      {status.err && <div style={{ color: 'red', marginBottom: 10 }}>{status.err}</div>}

      <form onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="Nueva contraseña (mín. 8)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          style={{ width: '100%', padding: 10, marginBottom: 10, borderRadius: 6, border: '1px solid #ccc' }}
        />
        <input
          type="password"
          placeholder="Repite la nueva contraseña"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          style={{ width: '100%', padding: 10, marginBottom: 10, borderRadius: 6, border: '1px solid #ccc' }}
        />
        <button
          type="submit"
          disabled={status.loading || !token}
          style={{ width: '100%', padding: 10, borderRadius: 6, border: 'none', background: '#28a745', color: '#fff' }}
        >
          {status.loading ? 'Actualizando…' : 'Guardar nueva contraseña'}
        </button>
      </form>

      <button
        onClick={() => history.push('/')}
        style={{ width: '100%', marginTop: 10, padding: 10, borderRadius: 6, border: '1px solid #ccc', background: '#f8f9fa' }}
      >
        Volver al inicio
      </button>
    </div>
  );
};

export default ResetPassword;
