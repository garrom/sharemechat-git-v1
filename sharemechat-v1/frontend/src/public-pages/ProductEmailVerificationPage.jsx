import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../config/http';

const cardStyle = {
  width: '100%',
  maxWidth: 560,
  background: '#fff',
  border: '1px solid #d9e2f2',
  borderRadius: 18,
  padding: '28px 26px',
  boxShadow: '0 18px 40px rgba(15, 24, 38, 0.08)',
};

const ProductEmailVerificationPage = () => {
  const [state, setState] = useState({ loading: true, ok: false, message: '' });

  const token = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('token') || '';
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!token) {
        setState({ loading: false, ok: false, message: 'Falta el token de validacion.' });
        return;
      }
      try {
        const response = await apiFetch(`/email-verification/confirm?token=${encodeURIComponent(token)}`);
        if (!cancelled) {
          setState({ loading: false, ok: Boolean(response?.ok), message: response?.message || 'Email validado correctamente.' });
        }
      } catch (e) {
        const message = e?.data?.message || e?.message || 'No se pudo validar el email.';
        if (!cancelled) {
          setState({ loading: false, ok: false, message });
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'linear-gradient(180deg, #f6f8fb 0%, #ffffff 100%)' }}>
      <div style={cardStyle}>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#16324f' }}>SharemeChat</div>
        <div style={{ marginTop: 10, color: '#5f6b7a', fontSize: 14, lineHeight: 1.6 }}>
          Validacion de email para continuar con tu cuenta.
        </div>
        <div style={{
          marginTop: 18,
          padding: '14px 16px',
          borderRadius: 14,
          border: `1px solid ${state.ok ? '#bfe9ca' : '#f1c4bf'}`,
          background: state.ok ? '#ecfbf0' : '#fff1f0',
          color: state.ok ? '#166534' : '#b42318',
          lineHeight: 1.55,
        }}>
          {state.loading ? 'Validando enlace...' : state.message}
        </div>
        <div style={{ marginTop: 18, fontSize: 13 }}>
          <Link to="/login" style={{ color: '#0f4aa8', fontWeight: 700, textDecoration: 'none' }}>
            Volver al acceso
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ProductEmailVerificationPage;
