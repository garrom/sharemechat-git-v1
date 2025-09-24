// src/consent/GuestConsentGate.jsx
import React, { useEffect, useState } from 'react';
import AgeGateModal from './AgeGateModal';
import { TERMS_VERSION, isLocalAgeOk, isLocalTermsOk } from './consentClient';

const GuestConsentGate = ({ children }) => {
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const ageOk = isLocalAgeOk(TERMS_VERSION);
    const termsOk = isLocalTermsOk(TERMS_VERSION);
    if (ageOk && termsOk) {
      setAllowed(true);
      setOpen(false);
    } else {
      setAllowed(false);
      setOpen(true);
    }
  }, []);

  const handleAccepted = () => {
    setAllowed(true);
    setOpen(false);
  };

  return (
    <>
      {open && <AgeGateModal onAccepted={handleAccepted} />}
      {allowed ? children : null}
    </>
  );
};

export default GuestConsentGate;
