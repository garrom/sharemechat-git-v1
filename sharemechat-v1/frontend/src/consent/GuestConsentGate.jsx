import React, { useEffect, useState } from 'react';
import AgeGateModal from './AgeGateModal';
import { TERMS_VERSION, isLocalAgeOk } from './consentClient';
import { isAdminSurface } from '../utils/runtimeSurface';

const GuestConsentGate = ({ children }) => {
  const adminSurface = isAdminSurface();
  const [resolved, setResolved] = useState(() => {
    if (adminSurface) return true;
    try {
      return isLocalAgeOk(TERMS_VERSION);
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (adminSurface) {
      setResolved(true);
      return;
    }

    try {
      setResolved(isLocalAgeOk(TERMS_VERSION));
    } catch {
      setResolved(false);
    }
  }, [adminSurface]);

  const handleAccepted = () => {
    setResolved(true);
  };

  return (
    <>
      {children}
      {!resolved && <AgeGateModal onAccepted={handleAccepted} />}
    </>
  );
};

export default GuestConsentGate;
