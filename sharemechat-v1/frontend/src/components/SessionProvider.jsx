import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import i18n from '../i18n';
import { apiFetch } from '../config/http';

const SessionContext = createContext({
  user: null,
  loading: true,
  error: null,
  refresh: async () => {}
});

export const useSession = () => useContext(SessionContext);

export const SessionProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const applyLocale = (u) => {
    const uiLocale = (u && (u.uiLocale || u.ui_locale)) ? (u.uiLocale || u.ui_locale) : null;
    if (!uiLocale) return;

    const normalized = String(uiLocale).toLowerCase().slice(0, 2);
    try {
      i18n.changeLanguage(normalized);
    } catch (e) {
      // No rompemos bootstrap por un fallo de i18n
    }
  };

  // SessionProvider.jsx (sustituye SOLO loadMe por esto)
  const loadMe = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch('/users/me');

      setUser(data || null);
      applyLocale(data);

      setLoading(false);
      return data || null;
    } catch (e) {
      const msg = String(e?.message || '');

      // ✅ Solo consideramos "sin sesión" cuando es 401
      if (msg.includes('401')) {
        setUser(null);
      } else {
        // ✅ Si es un error temporal (502/504/etc), NO tiramos al usuario
        // mantenemos el user anterior para no expulsar a nadie
        // (si user ya era null, seguirá null)
      }

      setLoading(false);

      // Guardamos error solo si no es 401
      if (!msg.includes('401')) {
        setError(e);
      }

      return msg.includes('401') ? null : user;
    }
  };


  useEffect(() => {
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    error,
    refresh: loadMe
  }), [user, loading, error]);

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};