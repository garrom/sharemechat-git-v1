import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';

const box = {
  maxWidth: 400,
  margin: '40px auto',
  padding: 20,
  border: '1px solid #eee',
  borderRadius: 8,
  boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
};

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState({ loading: false, ok: '', err: '' });
  const history = useHistory();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, ok: '', err: '' });
    try {
      const res = await fetch('/api/auth/password/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      // Respuesta homogénea: mostramos mensaje de éxito siempre
      if (!res.ok) {
        // Igual mostramos OK para no filtrar existencia de emails
        // pero si quieres, puedes leer el texto
        // const txt = await res.text();
      }
      setStatus({
        loading: false,
        ok: 'Si el email existe, te hemos enviado un enlace para restablecer tu contraseña.',
        err: '',
      });
    } catch (err) {
      setStatus({ loading: false, ok: '', err: 'Error de conexión. Inténtalo de nuevo.' });
    }
  };

  return (
    <div style={box}>
      <h2>Recuperar contraseña</h2>
      <p>Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.</p>
      {status.ok && <div style={{ color: 'green', marginBottom: 10 }}>{status.ok}</div>}
      {status.err && <div style={{ color: 'red', marginBottom: 10 }}>{status.err}</div>}
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Tu email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: '100%', padding: 10, marginBottom: 10, borderRadius: 6, border: '1px solid #ccc' }}
        />
        <button
          type="submit"
          disabled={status.loading}
          style={{ width: '100%', padding: 10, borderRadius: 6, border: 'none', background: '#007bff', color: '#fff' }}
        >
          {status.loading ? 'Enviando…' : 'Enviar enlace'}
        </button>
      </form>
      <button
        onClick={() => history.push('/')}
        style={{ width: '100%', marginTop: 10, padding: 10, borderRadius: 6, border: '1px solid #ccc', background: '#f8f9fa' }}
      >
        Volver
      </button>
    </div>
  );
};

export default ForgotPassword;
