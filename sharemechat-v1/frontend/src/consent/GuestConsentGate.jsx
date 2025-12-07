// src/consent/GuestConsentGate.jsx
import React, { useEffect, useState } from 'react';
import AgeGateModal from './AgeGateModal';
import { TERMS_VERSION, isLocalAgeOk, isLocalTermsOk } from './consentClient';

const COOKIE_KEY = 'smc_cookie_consent';

const GuestConsentGate = ({ children }) => {
  const [cookiesDone, setCookiesDone] = useState(false);
  const [showAgeGate, setShowAgeGate] = useState(false);

  // 1) Esperar a que el usuario tome una decisión de cookies (CookieBanner escribe smc_cookie_consent)
  useEffect(() => {
    const hasCookieConsent = () => {
      try {
        return !!localStorage.getItem(COOKIE_KEY);
      } catch {
        return false;
      }
    };

    if (hasCookieConsent()) {
      setCookiesDone(true);
      return;
    }

    const id = setInterval(() => {
      if (hasCookieConsent()) {
        setCookiesDone(true);
        clearInterval(id);
      }
    }, 500);

    return () => clearInterval(id);
  }, []);

  // 2) Cuando ya hay decisión de cookies, aplicamos age-gate / TyC
  useEffect(() => {
    if (!cookiesDone) return;
    const ageOk = isLocalAgeOk(TERMS_VERSION);
    const termsOk = isLocalTermsOk(TERMS_VERSION);
    setShowAgeGate(!(ageOk && termsOk));
  }, [cookiesDone]);

  const handleAccepted = () => {
    setShowAgeGate(false);
  };

  return (
    <>
      {/* SIEMPRE renderizamos el contenido → el footer ya no se va arriba solo */}
      {children}
      {/* El modal sólo aparece cuando toca, pero como overlay fijo */}
      {cookiesDone && showAgeGate && <AgeGateModal onAccepted={handleAccepted} />}
    </>
  );
};

export default GuestConsentGate;
