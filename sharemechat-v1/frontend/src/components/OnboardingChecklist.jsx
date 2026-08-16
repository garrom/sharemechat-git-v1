// src/components/OnboardingChecklist.jsx
//
// Marcadores de onboarding del cliente recien registrado. Se renderizan
// dentro de la barra "Modo gratuito / Hazte Premium" del videochat
// (VideoChatRandomUser -> TrialFreeBanner), inyectados como slot desde
// DashboardUserClient via la prop onboardingSlot.
//
// Onboarding = las 2 verificaciones que desbloquean la plataforma:
//   1. Verificar email (user.emailVerifiedAt).
//   2. Verificar edad / KYC (clientKycStatus === APPROVED).
//
// El tercer "paso" historico (cargar saldo) se elimino a proposito:
// cargar saldo = hacerse premium, que ya vive en el boton "Hazte Premium"
// de la misma barra y ademas es opcional (el usuario puede seguir en modo
// gratuito). No es un paso de onboarding obligatorio.
//
// Cada marcador: circulo verde hueco (pendiente) o check verde tachado
// (hecho). Bajo el marcador de email, cuando esta pendiente, un enlace
// pequeno "reenviar email" (delegado al handler del padre). Cuando ambas
// verificaciones estan hechas, el componente no renderiza nada.

import React from 'react';
import { useHistory } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import i18n from '../i18n';
import { useSession } from './SessionProvider';

const rowStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 22,
  flexWrap: 'wrap',
};

const markerStyle = { display: 'inline-flex', alignItems: 'center', gap: 9 };

const ringDone = {
  width: 18,
  height: 18,
  borderRadius: 999,
  background: '#22c55e',
  color: '#06240f',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 10,
  flexShrink: 0,
};

const ringPending = {
  width: 18,
  height: 18,
  borderRadius: 999,
  border: '2px solid #3ddc84',
  boxSizing: 'border-box',
  flexShrink: 0,
};

const labelBase = { fontSize: 13, lineHeight: 1.25, color: '#eef3ff' };
const labelDone = { ...labelBase, color: '#bfe9cf', textDecoration: 'line-through' };

const linkButtonReset = {
  background: 'none',
  border: 0,
  padding: 0,
  font: 'inherit',
  cursor: 'pointer',
};

const ageLinkStyle = {
  ...linkButtonReset,
  ...labelBase,
  textDecoration: 'underline',
  textUnderlineOffset: 2,
};

const emailColStyle = { display: 'flex', flexDirection: 'column', lineHeight: 1.2 };
const sublineStyle = { fontSize: 10.5, color: '#a9b8dd', marginTop: 1 };
const resendLinkStyle = {
  ...linkButtonReset,
  fontSize: 10.5,
  color: '#7fe6a6',
  textDecoration: 'underline',
  textUnderlineOffset: 2,
};

const OnboardingChecklist = ({ onResendEmail = null, resending = false }) => {
  const t = (key) => i18n.t(key);
  const history = useHistory();
  const { user } = useSession();

  if (!user) return null;
  if (String(user.role || '').toUpperCase() === 'CLIENT') return null;

  const emailVerified = !!user.emailVerifiedAt;
  const ageVerified = String(user.clientKycStatus || '').toUpperCase() === 'APPROVED';

  // Ambas verificaciones hechas -> no hay onboarding que mostrar.
  if (emailVerified && ageVerified) return null;

  const handleResend = () => {
    if (resending) return;
    if (typeof onResendEmail === 'function') onResendEmail();
  };

  return (
    <div style={rowStyle} role="group" aria-label={t('dashboardUserClient.onboarding.verifyEmail')}>
      {/* Verificar email */}
      <span style={markerStyle}>
        {emailVerified ? (
          <span style={ringDone} aria-hidden="true"><FontAwesomeIcon icon={faCheck} /></span>
        ) : (
          <span style={ringPending} aria-hidden="true" />
        )}
        {emailVerified ? (
          <span style={labelDone}>{t('dashboardUserClient.onboarding.verifyEmail')}</span>
        ) : (
          <span style={emailColStyle}>
            <span style={labelBase}>{t('dashboardUserClient.onboarding.verifyEmail')}</span>
            <span style={sublineStyle}>
              {t('dashboardUserClient.emailVerification.notReceived')}{' '}
              <button type="button" style={resendLinkStyle} onClick={handleResend} disabled={resending}>
                {resending
                  ? t('dashboardUserClient.emailVerification.resending')
                  : t('dashboardUserClient.emailVerification.resend')}
              </button>
            </span>
          </span>
        )}
      </span>

      {/* Verificar edad */}
      <span style={markerStyle}>
        {ageVerified ? (
          <span style={ringDone} aria-hidden="true"><FontAwesomeIcon icon={faCheck} /></span>
        ) : (
          <span style={ringPending} aria-hidden="true" />
        )}
        {ageVerified ? (
          <span style={labelDone}>{t('dashboardUserClient.onboarding.verifyAge')}</span>
        ) : (
          <button type="button" style={ageLinkStyle} onClick={() => history.push('/client-kyc')}>
            {t('dashboardUserClient.onboarding.verifyAge')}
          </button>
        )}
      </span>
    </div>
  );
};

export default OnboardingChecklist;
