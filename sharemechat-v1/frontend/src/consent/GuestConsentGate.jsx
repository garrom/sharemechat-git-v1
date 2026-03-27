// src/consent/GuestConsentGate.jsx
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

  if (!resolved) {
    return <AgeGateModal onAccepted={handleAccepted} />;
  }

  return children;
};

export default GuestConsentGate;
