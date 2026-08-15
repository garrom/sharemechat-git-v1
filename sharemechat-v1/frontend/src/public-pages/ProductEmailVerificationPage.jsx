import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../config/http';

// Pagina publica "email verificado" (ruta /verify-email). Rediseno de marca
// 2026-08-15: tarjeta minimalista (logo + check verde + titular + boton),
// rojo de marca #ea1d1d, sin fotos. Confirma el token contra
// /email-verification/confirm y muestra exito / error / cargando.

const RED = '#ea1d1d';
const INK = '#141820';
const MUTED = '#6b7280';

const pageStyle = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: 24,
  background: '#f7f4f4',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
};

const cardStyle = {
  width: '100%',
  maxWidth: 420,
  background: '#fff',
  border: '1px solid #ececec',
  borderRadius: 16,
  padding: '40px 32px',
  boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
  textAlign: 'center',
};

const btnStyle = {
  display: 'inline-block',
  background: RED,
  color: '#fff',
  textDecoration: 'none',
  fontWeight: 700,
  fontSize: 15,
  padding: '13px 30px',
  borderRadius: 9,
  boxShadow: '0 8px 18px rgba(234,29,29,0.28)',
};

const Wordmark = () => (
  <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em', color: INK, marginBottom: 24 }}>
    Shareme<span style={{ color: RED }}>Chat</span>
  </div>
);

const CheckCircle = () => (
  <div style={{
    width: 66, height: 66, borderRadius: '50%', background: 'rgba(21,128,61,0.12)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  }}>
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#15803d"
         strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  </div>
);

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
        setState({ loading: false, ok: false, message: 'Falta el token de validación.' });
        return;
      }
      try {
        const response = await apiFetch(`/email-verification/confirm?token=${encodeURIComponent(token)}`);
        if (!cancelled) {
          setState({ loading: false, ok: Boolean(response?.ok), message: response?.message || '' });
        }
      } catch (e) {
        const message = e?.data && typeof e.data.message === 'string' && e.data.message.trim()
          ? e.data.message
          : 'No se pudo validar el email. Inténtalo más tarde.';
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
    <div style={pageStyle}>
      <div style={cardStyle}>
        <Wordmark />

        {state.loading ? (
          <p style={{ color: MUTED, fontSize: 14.5, margin: 0 }}>Validando enlace…</p>
        ) : state.ok ? (
          <>
            <CheckCircle />
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px', color: INK, letterSpacing: '-0.01em' }}>
              Email verificado
            </h1>
            <p style={{ margin: '0 0 26px', color: MUTED, fontSize: 14.5, lineHeight: 1.55 }}>
              Tu correo se ha confirmado correctamente. Te avisaremos por email en cuanto SharemeChat abra.
            </p>
            <a href="/" style={btnStyle}>Volver a SharemeChat</a>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px', color: INK }}>
              No se pudo verificar tu email
            </h1>
            <p style={{ margin: '0 0 26px', color: MUTED, fontSize: 14.5, lineHeight: 1.55 }}>
              {state.message || 'El enlace no es válido o ha caducado.'}
            </p>
            <a href="/" style={btnStyle}>Volver a SharemeChat</a>
          </>
        )}
      </div>
    </div>
  );
};

export default ProductEmailVerificationPage;
