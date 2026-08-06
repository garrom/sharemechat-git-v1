import React, { useEffect, useRef, useState } from 'react';

/**
 * Botón oficial "Sign in with Google" via Google Identity Services (GIS).
 *
 * Renderiza el botón oficial de Google (google.accounts.id.renderButton)
 * y cuando el usuario completa el flujo GIS pasa el ID token JWT al
 * callback `onIdToken(idToken, intent)`. Es responsabilidad del caller
 * enviarlo al backend (POST /api/auth/google).
 *
 * Requisitos:
 * - <script src="https://accounts.google.com/gsi/client" async defer>
 *   ya cargado en index.html.
 * - Variable de entorno REACT_APP_GOOGLE_OAUTH_CLIENT_ID poblada en
 *   build time (`.env.product`, `.env.admin`). El mismo Client ID sirve
 *   para los 3 entornos (TEST/AUDIT/PROD) porque los 3 orígenes están
 *   autorizados en la misma OAuth app de Google Cloud (ADR-058 §D3).
 *   Sin él, el componente muestra un aviso y no renderiza el botón.
 *
 * Prop `intent`: se pasa tal cual al callback padre para que decida el
 * body de la request al backend (login vs register-client). No afecta
 * al render del botón GIS.
 */
export default function GoogleSignInButton({ onIdToken, onError, intent = 'login' }) {
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  // Ancho medido dinámicamente para que el botón oficial GIS
  // ocupe el mismo ancho que los botones nativos del formulario.
  // GIS renderButton acepta un número (px) con máximo 400.
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const [gisReadyTick, setGisReadyTick] = useState(0);

  const clientId = process.env.REACT_APP_GOOGLE_OAUTH_CLIENT_ID;

  // Fase 1: espera a que el script GIS esté cargado y marca ready.
  useEffect(() => {
    if (!clientId) {
      setError('Google Sign-In no está configurado en este entorno');
      return;
    }
    let attempts = 0;
    const maxAttempts = 30; // 30 * 100ms = 3s (defensa adblocker)
    const interval = setInterval(() => {
      attempts += 1;
      if (window.google && window.google.accounts && window.google.accounts.id) {
        clearInterval(interval);
        setGisReadyTick((t) => t + 1);
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        setError('Google Sign-In no disponible (¿bloqueado por adblocker?)');
      }
    }, 100);
    return () => clearInterval(interval);
  }, [clientId]);

  // Fase 2: mide el ancho del contenedor y re-mide en resize.
  useEffect(() => {
    if (!containerRef.current) return;
    const measure = () => {
      if (!containerRef.current) return;
      const w = Math.round(containerRef.current.getBoundingClientRect().width);
      // GIS limita a [200, 400]. Clamp para evitar warning y look raro.
      const clamped = Math.min(400, Math.max(200, w || 320));
      setMeasuredWidth((prev) => (prev === clamped ? prev : clamped));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Fase 3: renderiza el botón GIS cada vez que cambia el ancho medido,
  // el intent o cuando GIS acaba de cargar. Limpia el contenedor antes
  // porque renderButton adjunta, no reemplaza.
  useEffect(() => {
    if (!clientId) return;
    if (!measuredWidth) return;
    if (!containerRef.current) return;
    if (!(window.google && window.google.accounts && window.google.accounts.id)) return;
    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response && response.credential) {
            onIdToken(response.credential, intent);
          } else if (onError) {
            onError('Sin credencial en la respuesta de Google');
          }
        },
        use_fedcm_for_prompt: true, // evita third-party cookies
      });
      containerRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(containerRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: intent === 'register-client' ? 'signup_with' : 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: measuredWidth,
      });
      setReady(true);
    } catch (e) {
      setError('No se pudo inicializar Google Sign-In');
      if (onError) onError(e && e.message ? e.message : 'GIS init error');
    }
    // onIdToken/onError se asumen estables desde el padre (envolver con
    // useCallback si no).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, intent, measuredWidth, gisReadyTick]);

  if (error) {
    return (
      <div role="alert" style={{ fontSize: 12, color: '#b45309', margin: '8px 0' }}>
        {error}
      </div>
    );
  }

  return (
    <div
      data-testid="google-signin-button"
      data-ready={ready ? 'true' : 'false'}
      ref={containerRef}
      style={{ margin: '8px 0', width: '100%', display: 'block' }}
    />
  );
}
