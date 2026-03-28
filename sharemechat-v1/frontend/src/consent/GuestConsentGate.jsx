import React, { useEffect, useState } from 'react';
import AgeGateModal from './AgeGateModal';
import { TERMS_VERSION, isLocalAgeOk } from './consentClient';

const GuestConsentGate = ({ children }) => {
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    try {
      setResolved(isLocalAgeOk(TERMS_VERSION));
    } catch {
      setResolved(false);
    }
  }, []);

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