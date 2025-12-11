// src/components/CallUiContext.js
import React, { createContext, useContext, useState } from 'react';

const CallUiContext = createContext(null);

export const CallUiProvider = ({ children }) => {
  const [inCall, setInCall] = useState(false);
  const value = { inCall, setInCall };
  return <CallUiContext.Provider value={value}>{children}</CallUiContext.Provider>;
};

export const useCallUi = () => {
  const ctx = useContext(CallUiContext);
  if (!ctx) {
    throw new Error('useCallUi debe usarse dentro de un CallUiProvider');
  }
  return ctx;
};
