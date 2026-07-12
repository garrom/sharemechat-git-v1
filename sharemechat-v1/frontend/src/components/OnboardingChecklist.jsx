// src/components/OnboardingChecklist.jsx
//
// Widget de onboarding para el cliente recien registrado. Vive en
// DashboardUserClient (mientras el user es role=USER + userType=
// FORM_CLIENT) y le guia visualmente por los 2 pasos que faltan para
// tener acceso pleno a SharemeChat:
//
//   1. Verificar edad (KYC Didit). Cuando el backend responde
//      clientKycStatus=APPROVED, el paso queda ✓ automatico.
//   2. Cargar primer saldo (primer pago). Cuando el pago se completa,
//      el backend promociona el user a role=CLIENT y el usuario pasa
//      al DashboardClient (donde este widget no vive), por lo que el
//      paso 2 solo se ve como ✓ durante el momento breve entre el
//      pago y el redirect.
//
// Dismiss: el user puede ocultar el widget con la X arriba. La
// persistencia usa sessionStorage (no localStorage) para que el
// widget vuelva a aparecer al abrir el navegador de nuevo — la
// mayoria de usuarios no sabe limpiar cache y necesitamos un
// mecanismo de "retomar" natural. Dentro de la misma sesion de
// navegador respetamos el dismiss (guardando el snapshot de pasos
// completos en el momento del dismiss); si el usuario progresa
// despues (completa el KYC), el widget vuelve a mostrarse para
// guiarle al siguiente paso.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCircle, faXmark } from '@fortawesome/free-solid-svg-icons';
import i18n from '../i18n';
import { useSession } from './SessionProvider';
import { useAppModals } from './useAppModals';

const DISMISS_STORAGE_PREFIX = 'sharemechat.onboarding_dismissed.';

// ============================================================
// Estilos inline coherentes con el resto del proyecto.
// Fondo pastel azul + borde azul suave. Diferente del banner amarillo
// de EmailVerificationBanner que ya vive en el mismo dashboard, para
// no confundir.
// ============================================================
const wrapStyle = {
  width: '100%',
  maxWidth: 640,
  margin: '12px auto 0 auto',
  padding: '14px 16px 12px 16px',
  borderRadius: 14,
  border: '1px solid rgba(59, 130, 246, 0.35)',
  background: 'rgba(219, 234, 254, 0.97)',
  boxShadow: '0 10px 24px rgba(18, 24, 38, 0.08)',
  color: '#1e3a8a',
  boxSizing: 'border-box',
};

const headerRowStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  marginBottom: 10,
};

const titleColStyle = { minWidth: 0, flex: 1 };
const titleStyle = {
  fontSize: 14,
  fontWeight: 800,
  lineHeight: 1.3,
  color: '#1e3a8a',
  margin: 0,
};
const subtitleStyle = {
  fontSize: 12,
  lineHeight: 1.4,
  color: 'rgba(30, 58, 138, 0.85)',
  marginTop: 2,
};

const dismissBtnStyle = {
  flexShrink: 0,
  width: 28,
  height: 28,
  borderRadius: 999,
  border: '1px solid rgba(30, 58, 138, 0.25)',
  background: 'rgba(255, 255, 255, 0.6)',
  color: '#1e3a8a',
  cursor: 'pointer',
  fontSize: 12,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const stepsListStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  marginTop: 4,
};

const stepRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '8px 10px',
  borderRadius: 10,
  background: 'rgba(255, 255, 255, 0.72)',
  border: '1px solid rgba(59, 130, 246, 0.18)',
};

const stepIconWrap = (done) => ({
  flexShrink: 0,
  width: 26,
  height: 26,
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: done ? '#16a34a' : 'rgba(148, 163, 184, 0.25)',
  color: done ? '#ffffff' : '#64748b',
  fontSize: 11,
});

const stepTextCol = { flex: 1, minWidth: 0 };
const stepLabel = (done) => ({
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.2,
  color: done ? '#166534' : '#1e3a8a',
  textDecoration: done ? 'line-through' : 'none',
});
const stepDesc = {
  fontSize: 11,
  lineHeight: 1.4,
  color: 'rgba(30, 58, 138, 0.75)',
  marginTop: 2,
};

const ctaBtnBase = {
  flexShrink: 0,
  height: 32,
  padding: '0 14px',
  borderRadius: 999,
  border: 'none',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
const ctaPrimaryStyle = {
  ...ctaBtnBase,
  background: '#f97316',
  color: '#ffffff',
};
const ctaDisabledStyle = {
  ...ctaBtnBase,
  background: 'rgba(148, 163, 184, 0.35)',
  color: 'rgba(30, 41, 59, 0.5)',
  cursor: 'not-allowed',
};

// ============================================================
// Utils sessionStorage (defensivos: incognito puede lanzar en Safari).
// Usamos sessionStorage en vez de localStorage para que el dismiss
// solo dure la sesion actual del navegador; al abrirlo de nuevo el
// widget vuelve — la mayoria de usuarios no sabe limpiar cache.
// ============================================================
const readDismissedCount = (userId) => {
  if (!userId) return null;
  try {
    const raw = sessionStorage.getItem(`${DISMISS_STORAGE_PREFIX}${userId}`);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
};

const writeDismissedCount = (userId, count) => {
  if (!userId) return;
  try {
    sessionStorage.setItem(`${DISMISS_STORAGE_PREFIX}${userId}`, String(count));
  } catch {
    // sessionStorage bloqueado (Safari incognito, permisos). Fail silently.
  }
};

// ============================================================
// Componente
// ============================================================
const OnboardingChecklist = ({ onLoadBalance = null }) => {
  const t = useCallback((key, options) => i18n.t(key, options), []);
  const history = useHistory();
  const { user } = useSession();
  const { openPurchaseModal } = useAppModals();

  const userId = user?.id ?? null;

  // Derivacion de estado desde el user actual.
  const kycApproved = String(user?.clientKycStatus || '').toUpperCase() === 'APPROVED';
  const isClient = String(user?.role || '').toUpperCase() === 'CLIENT';

  // Numero de pasos "de negocio" completos (0, 1 o 2). El paso 0
  // ("cuenta creada") no cuenta aqui: la lista lo muestra siempre ✓
  // pero no forma parte del progreso hacia el dismiss.
  const completedCount = (kycApproved ? 1 : 0) + (isClient ? 1 : 0);

  const [dismissedCount, setDismissedCount] = useState(() => readDismissedCount(userId));

  // Si el user cambia (login/logout), releer el flag del storage.
  useEffect(() => {
    setDismissedCount(readDismissedCount(userId));
  }, [userId]);

  const handleDismiss = useCallback(() => {
    writeDismissedCount(userId, completedCount);
    setDismissedCount(completedCount);
  }, [userId, completedCount]);

  const handleGoKyc = useCallback(() => {
    history.push('/client-kyc');
  }, [history]);

  const handleOpenPurchase = useCallback(() => {
    // openPurchaseModal es una promesa que resuelve con el pack
    // seleccionado, pero NO ejecuta el pago; es responsabilidad del
    // caller hacer el POST /transactions/first + alert + redirect.
    // Delegamos al handler del padre (DashboardUserClient.handleFirstPayment)
    // para no duplicar la logica de primer pago aqui. Fallback: si
    // el padre no pasa onLoadBalance, abrimos la modal sin cablear
    // el pago (modo degradado que solo mostrara los packs sin cobrar).
    if (typeof onLoadBalance === 'function') {
      onLoadBalance();
      return;
    }
    openPurchaseModal({ context: 'manual' });
  }, [onLoadBalance, openPurchaseModal]);

  // Reglas de visibilidad:
  //  - Si ambos pasos ya estan completos, no hay nada que guiar.
  //  - Si el user esta autenticado como CLIENT pero por alguna razon
  //    esta viendo este dashboard (edge case), no mostrar.
  //  - Si el user dismissed en un progreso equivalente al actual,
  //    no mostrar (respetamos su decision hasta el proximo avance).
  const hidden = useMemo(() => {
    if (!user) return true;
    if (isClient) return true;
    if (completedCount >= 2) return true;
    if (dismissedCount !== null && dismissedCount === completedCount) return true;
    return false;
  }, [user, isClient, completedCount, dismissedCount]);

  if (hidden) return null;

  const step2Disabled = !kycApproved;

  return (
    <aside style={wrapStyle} aria-labelledby="onboarding-checklist-title" role="region">
      <div style={headerRowStyle}>
        <div style={titleColStyle}>
          <h2 id="onboarding-checklist-title" style={titleStyle}>
            {t('onboardingChecklist.title')}
          </h2>
          <div style={subtitleStyle}>{t('onboardingChecklist.subtitle')}</div>
        </div>
        <button
          type="button"
          style={dismissBtnStyle}
          onClick={handleDismiss}
          aria-label={t('onboardingChecklist.dismiss')}
          title={t('onboardingChecklist.dismiss')}
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>

      <div style={stepsListStyle}>
        {/* Paso 0: cuenta creada — siempre ✓ */}
        <div style={stepRowStyle}>
          <span style={stepIconWrap(true)} aria-hidden="true">
            <FontAwesomeIcon icon={faCheck} />
          </span>
          <div style={stepTextCol}>
            <div style={stepLabel(true)}>
              {t('onboardingChecklist.steps.accountCreated.label')}
            </div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>
            {t('onboardingChecklist.steps.accountCreated.done')}
          </span>
        </div>

        {/* Paso 1: verificar edad */}
        <div style={stepRowStyle}>
          <span style={stepIconWrap(kycApproved)} aria-hidden="true">
            <FontAwesomeIcon icon={kycApproved ? faCheck : faCircle} />
          </span>
          <div style={stepTextCol}>
            <div style={stepLabel(kycApproved)}>
              {t('onboardingChecklist.steps.verifyAge.label')}
            </div>
            {!kycApproved && (
              <div style={stepDesc}>{t('onboardingChecklist.steps.verifyAge.description')}</div>
            )}
          </div>
          {!kycApproved && (
            <button type="button" style={ctaPrimaryStyle} onClick={handleGoKyc}>
              {t('onboardingChecklist.steps.verifyAge.cta')}
            </button>
          )}
        </div>

        {/* Paso 2: cargar saldo */}
        <div style={stepRowStyle}>
          <span style={stepIconWrap(isClient)} aria-hidden="true">
            <FontAwesomeIcon icon={isClient ? faCheck : faCircle} />
          </span>
          <div style={stepTextCol}>
            <div style={stepLabel(isClient)}>
              {t('onboardingChecklist.steps.loadBalance.label')}
            </div>
            {!isClient && (
              <div style={stepDesc}>
                {step2Disabled
                  ? t('onboardingChecklist.steps.loadBalance.blockedHint')
                  : t('onboardingChecklist.steps.loadBalance.description')}
              </div>
            )}
          </div>
          {!isClient && (
            <button
              type="button"
              style={step2Disabled ? ctaDisabledStyle : ctaPrimaryStyle}
              onClick={handleOpenPurchase}
              disabled={step2Disabled}
              title={step2Disabled ? t('onboardingChecklist.steps.loadBalance.blockedHint') : undefined}
            >
              {t('onboardingChecklist.steps.loadBalance.cta')}
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

export default OnboardingChecklist;
