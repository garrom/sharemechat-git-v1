// src/public-pages/AffiliateLandingPage.jsx
//
// ADR-049 Subpasada 2E: landing publica del programa de afiliadas.
//
// Montada en dos rutas:
//   - GET /i?ref=<code>              → visitante llega por QR o URL directa.
//   - GET /register/client?ref=<code>&email_verified=true → destino del
//                                       redirect 302 del backend tras
//                                       consumir un magic link.
//
// Ambas rutas montan el mismo componente; la diferencia esta en query
// params:
//   - Si {@code ?ref=<code>} presente y NO hay sesion activa: la landing
//     registra el CLICK via POST /api/public/affiliate/click (setea
//     cookie 90d).
//   - Si {@code email_verified=true} presente: se abre automaticamente
//     el modal de registro cliente al mount.
//   - Si hay sesion activa (MODEL / CLIENT / ADMIN): la landing muestra
//     una card contextual sin ejecutar POST /click (no inflamos stats
//     con trafico interno).
//   - Si no hay {@code ?ref}: pantalla de "enlace invalido".
//
// El registro real (validaciones, consent, edad, terminos) sigue en el
// modal existente `RegisterClientModalContent` que se abre con
// {@code openLoginModal({ initialView: 'register-client' })} del hook
// {@code useAppModals}. Zero codigo nuevo de auth.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import i18n from '../i18n';
import { useSession } from '../components/SessionProvider';
import { useAppModals } from '../components/useAppModals';
import PublicNavbar from '../components/navbar/PublicNavbar';
import { recordClick, sendMagicLink } from '../api/affiliatePublicApi';

// ============================================================
// Regex del code Crockford Base32 (mismo que backend V16 CHECK).
// Sirve para validar el ?ref antes de golpear el endpoint.
// ============================================================
const REFERRAL_CODE_REGEX = /^[0-9A-HJKMNPQRSTVWXYZ]{12}$/;

// ============================================================
// Estilos inline coherentes con el tema oscuro del proyecto
// (#111418 background, #e5e7eb text, acentos #f97316 / #22c55e).
// Landing es publica: sin styled-components dedicados (mantenemos el
// bundle inicial pequeño; los styled solo aportarian si se reutilizara
// en varios sitios).
// ============================================================
const wrapStyle = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  background: '#111418',
  color: '#e5e7eb',
};

const mainStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  padding: '48px 20px 64px 20px',
  gap: 32,
};

const heroCardStyle = {
  width: '100%',
  maxWidth: 640,
  background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
  border: '1px solid rgba(148, 163, 184, 0.25)',
  borderRadius: 16,
  padding: '40px 32px',
  textAlign: 'center',
  boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
};

const eyebrowStyle = {
  fontSize: '0.85rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#f97316',
  marginBottom: 12,
};

const titleStyle = {
  fontSize: '2rem',
  fontWeight: 900,
  lineHeight: 1.2,
  color: '#f9fafb',
  marginTop: 0,
  marginBottom: 16,
};

const subtitleStyle = {
  fontSize: '1.05rem',
  lineHeight: 1.55,
  color: '#cbd5e1',
  marginBottom: 28,
  maxWidth: 520,
  marginLeft: 'auto',
  marginRight: 'auto',
};

const primaryCtaStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '14px 32px',
  borderRadius: 999,
  border: 'none',
  background: '#f97316',
  color: '#ffffff',
  fontSize: '1.05rem',
  fontWeight: 800,
  letterSpacing: '0.01em',
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(249, 115, 22, 0.35)',
  transition: 'transform 0.1s ease, box-shadow 0.15s ease',
};

const secondaryCtaStyle = {
  display: 'inline-block',
  marginTop: 16,
  padding: '10px 20px',
  color: '#cbd5e1',
  fontSize: '0.9rem',
  fontWeight: 600,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  textDecoration: 'underline',
};

const secondarySectionStyle = {
  width: '100%',
  maxWidth: 640,
  background: '#0f172a',
  border: '1px solid rgba(148, 163, 184, 0.15)',
  borderRadius: 14,
  padding: '28px 28px 24px 28px',
};

const secondaryTitleStyle = {
  fontSize: '1.1rem',
  fontWeight: 800,
  color: '#f9fafb',
  marginTop: 0,
  marginBottom: 8,
};

const secondaryDescriptionStyle = {
  fontSize: '0.92rem',
  lineHeight: 1.5,
  color: '#94a3b8',
  marginBottom: 16,
};

const magicLinkRowStyle = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  alignItems: 'stretch',
};

const magicLinkInputStyle = {
  flex: '1 1 200px',
  minWidth: 0,
  height: 44,
  padding: '0 14px',
  borderRadius: 10,
  border: '1px solid rgba(148, 163, 184, 0.35)',
  background: '#020617',
  color: '#e5e7eb',
  fontSize: '0.95rem',
  outline: 'none',
  boxSizing: 'border-box',
};

const magicLinkButtonStyle = {
  height: 44,
  padding: '0 20px',
  borderRadius: 10,
  border: 'none',
  background: '#22c55e',
  color: '#0b1220',
  fontSize: '0.95rem',
  fontWeight: 800,
  cursor: 'pointer',
  flexShrink: 0,
  whiteSpace: 'nowrap',
};

const feedbackSuccessStyle = {
  marginTop: 12,
  padding: '10px 14px',
  borderRadius: 8,
  background: 'rgba(34, 197, 94, 0.12)',
  border: '1px solid rgba(34, 197, 94, 0.35)',
  color: '#86efac',
  fontSize: '0.9rem',
};

const feedbackErrorStyle = {
  marginTop: 12,
  padding: '10px 14px',
  borderRadius: 8,
  background: 'rgba(239, 68, 68, 0.12)',
  border: '1px solid rgba(239, 68, 68, 0.35)',
  color: '#fca5a5',
  fontSize: '0.9rem',
};

const alreadyLoggedCardStyle = {
  ...heroCardStyle,
  textAlign: 'left',
  padding: '32px 28px',
};

const invalidCardStyle = {
  ...heroCardStyle,
  background: '#0f172a',
};

// ============================================================
// Componente
// ============================================================
const AffiliateLandingPage = () => {
  const t = useCallback((key, options) => i18n.t(key, options), []);
  const history = useHistory();
  const location = useLocation();
  const { user: sessionUser, loading: sessionLoading } = useSession();
  const { openLoginModal } = useAppModals();

  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  const [magicLinkStatus, setMagicLinkStatus] = useState('idle'); // idle | sending | success | error
  const [magicLinkError, setMagicLinkError] = useState(null);

  // Extraccion de query params (defensiva: URLSearchParams siempre existe
  // en navegadores modernos, incluidos los soportados por CRA).
  const query = new URLSearchParams(location.search);
  const rawCode = (query.get('ref') || '').trim().toUpperCase();
  const codeIsValid = REFERRAL_CODE_REGEX.test(rawCode);
  const emailVerified = query.get('email_verified') === 'true';

  // Guard para NO abrir el modal dos veces si el efecto vuelve a
  // ejecutarse (StrictMode en dev, cambios de query, etc.).
  const modalOpenedRef = useRef(false);
  // Guard para NO disparar POST /click dos veces en el mismo mount.
  const clickRecordedRef = useRef(false);

  // ----------------------------------------------------------------
  // Effect 1: POST /click al mount si code valido Y no hay sesion activa.
  // Espera a que la sesion resuelva (sessionLoading=false) para no
  // registrar CLICK antes de saber si el visitante ya esta logueado.
  // ----------------------------------------------------------------
  useEffect(() => {
    if (sessionLoading) return;
    if (!codeIsValid) return;
    if (sessionUser) return; // no inflamos stats con trafico interno
    if (clickRecordedRef.current) return;
    clickRecordedRef.current = true;
    // fire-and-forget; el backend responde 204 en happy y silent-skip
    // (D15). Cualquier error de red se traga silenciosamente: la UX de
    // la landing no depende de que el click quede registrado.
    recordClick(rawCode).catch(() => {});
  }, [sessionLoading, sessionUser, codeIsValid, rawCode]);

  // ----------------------------------------------------------------
  // Effect 2: si viene con email_verified=true (post-magic-link) y
  // no hay sesion, abrir el modal de registro cliente automaticamente.
  // ----------------------------------------------------------------
  useEffect(() => {
    if (sessionLoading) return;
    if (sessionUser) return;
    if (!emailVerified) return;
    if (modalOpenedRef.current) return;
    modalOpenedRef.current = true;
    openLoginModal({ initialView: 'register-client' });
  }, [sessionLoading, sessionUser, emailVerified, openLoginModal]);

  const handleOpenRegister = useCallback(() => {
    openLoginModal({ initialView: 'register-client' });
  }, [openLoginModal]);

  const handleOpenLogin = useCallback(() => {
    openLoginModal({ initialView: 'login' });
  }, [openLoginModal]);

  const handleSendMagicLink = useCallback(async (e) => {
    e.preventDefault();
    if (!codeIsValid) return;
    const email = magicLinkEmail.trim().toLowerCase();
    // Validacion basica de formato antes de golpear al backend.
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setMagicLinkStatus('error');
      setMagicLinkError(t('affiliateLanding.magicLink.errorInvalidEmail'));
      return;
    }
    setMagicLinkStatus('sending');
    setMagicLinkError(null);
    try {
      await sendMagicLink(rawCode, email);
      setMagicLinkStatus('success');
      setMagicLinkEmail('');
    } catch (err) {
      const status = err?.status || err?.response?.status;
      let msg = t('affiliateLanding.magicLink.errorGeneric');
      if (status === 429) {
        msg = t('affiliateLanding.magicLink.errorRateLimit');
      } else if (status === 400) {
        msg = t('affiliateLanding.magicLink.errorInvalidEmail');
      } else if (err?.data?.message) {
        msg = err.data.message;
      }
      setMagicLinkStatus('error');
      setMagicLinkError(msg);
    }
  }, [codeIsValid, rawCode, magicLinkEmail, t]);

  // ----------------------------------------------------------------
  // Render: 4 estados posibles
  //   A) code invalido o ausente → pantalla error
  //   B) sesion activa MODEL/ADMIN → mensaje contextual
  //   C) sesion activa CLIENT → mensaje contextual
  //   D) visitante anonimo (happy path) → landing completa
  // ----------------------------------------------------------------

  // Mientras carga la sesion, render minimo (evita flash de contenido).
  if (sessionLoading) {
    return (
      <div style={wrapStyle}>
        <PublicNavbar />
        <main style={mainStyle}>
          <div style={heroCardStyle}>
            <p style={{ color: '#94a3b8' }}>{t('common.loading', { defaultValue: 'Cargando…' })}</p>
          </div>
        </main>
      </div>
    );
  }

  // A) Code invalido o ausente.
  if (!codeIsValid) {
    return (
      <div style={wrapStyle}>
        <PublicNavbar />
        <main style={mainStyle}>
          <div style={invalidCardStyle}>
            <h1 style={titleStyle}>{t('affiliateLanding.invalidCode.title')}</h1>
            <p style={subtitleStyle}>{t('affiliateLanding.invalidCode.message')}</p>
            <button
              type="button"
              style={primaryCtaStyle}
              onClick={() => history.push('/')}
            >
              {t('affiliateLanding.invalidCode.cta')}
            </button>
          </div>
        </main>
      </div>
    );
  }

  // B / C) Sesion activa: card contextual segun rol.
  if (sessionUser) {
    const role = (sessionUser.role || '').toUpperCase();
    let message = '';
    let ctaLabel = '';
    let ctaTarget = '/';
    if (role === 'MODEL') {
      message = t('affiliateLanding.alreadyLogged.model.message');
      ctaLabel = t('affiliateLanding.alreadyLogged.model.cta');
      ctaTarget = '/model';
    } else if (role === 'ADMIN') {
      message = t('affiliateLanding.alreadyLogged.admin.message');
      ctaLabel = t('affiliateLanding.alreadyLogged.admin.cta');
      ctaTarget = '/dashboard-admin';
    } else if (role === 'CLIENT') {
      message = t('affiliateLanding.alreadyLogged.client.message');
      ctaLabel = t('affiliateLanding.alreadyLogged.client.cta');
      ctaTarget = '/client';
    } else {
      // USER pendiente de completar KYC o similar.
      message = t('affiliateLanding.alreadyLogged.client.message');
      ctaLabel = t('affiliateLanding.alreadyLogged.client.cta');
      ctaTarget = '/';
    }
    return (
      <div style={wrapStyle}>
        <PublicNavbar />
        <main style={mainStyle}>
          <div style={alreadyLoggedCardStyle}>
            <h1 style={{ ...titleStyle, fontSize: '1.6rem' }}>
              {t('affiliateLanding.alreadyLogged.title')}
            </h1>
            <p style={{ ...subtitleStyle, textAlign: 'left', marginLeft: 0, marginRight: 0 }}>
              {message}
            </p>
            <button
              type="button"
              style={primaryCtaStyle}
              onClick={() => history.push(ctaTarget)}
            >
              {ctaLabel}
            </button>
          </div>
        </main>
      </div>
    );
  }

  // D) Happy path: visitante anonimo con code valido.
  return (
    <div style={wrapStyle}>
      <PublicNavbar />
      <main style={mainStyle}>
        {/* Hero card */}
        <div style={heroCardStyle}>
          <div style={eyebrowStyle}>{t('affiliateLanding.hero.eyebrow')}</div>
          <h1 style={titleStyle}>{t('affiliateLanding.hero.title')}</h1>
          <p style={subtitleStyle}>{t('affiliateLanding.hero.subtitle')}</p>
          <button
            type="button"
            style={primaryCtaStyle}
            onClick={handleOpenRegister}
          >
            {t('affiliateLanding.hero.ctaRegister')}
          </button>
          <div>
            <button
              type="button"
              style={secondaryCtaStyle}
              onClick={handleOpenLogin}
            >
              {t('affiliateLanding.hero.ctaLogin')}
            </button>
          </div>
        </div>

        {/* Magic link section */}
        <section style={secondarySectionStyle}>
          <h2 style={secondaryTitleStyle}>{t('affiliateLanding.magicLink.title')}</h2>
          <p style={secondaryDescriptionStyle}>
            {t('affiliateLanding.magicLink.description')}
          </p>
          <form style={magicLinkRowStyle} onSubmit={handleSendMagicLink}>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={t('affiliateLanding.magicLink.emailPlaceholder')}
              value={magicLinkEmail}
              onChange={(e) => setMagicLinkEmail(e.target.value)}
              disabled={magicLinkStatus === 'sending'}
              aria-label={t('affiliateLanding.magicLink.emailPlaceholder')}
              style={magicLinkInputStyle}
              required
            />
            <button
              type="submit"
              style={{
                ...magicLinkButtonStyle,
                opacity: magicLinkStatus === 'sending' ? 0.65 : 1,
                cursor: magicLinkStatus === 'sending' ? 'not-allowed' : 'pointer',
              }}
              disabled={magicLinkStatus === 'sending'}
            >
              {magicLinkStatus === 'sending'
                ? t('affiliateLanding.magicLink.sending')
                : t('affiliateLanding.magicLink.submit')}
            </button>
          </form>
          {magicLinkStatus === 'success' && (
            <div style={feedbackSuccessStyle} role="status">
              {t('affiliateLanding.magicLink.success')}
            </div>
          )}
          {magicLinkStatus === 'error' && magicLinkError && (
            <div style={feedbackErrorStyle} role="alert">
              {magicLinkError}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default AffiliateLandingPage;
