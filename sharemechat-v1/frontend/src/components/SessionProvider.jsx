import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import i18n from '../i18n';
import { apiFetch } from '../config/http';
import {
  getResolvedLocale,
  getUserUiLocale,
  normalizeLocale,
  setStoredLocale
} from '../i18n/localeUtils';
;

const SessionContext = createContext({
  user: null,
  loading: true,
  error: null,
  refresh: async () => {},
  updateUiLocale: async () => {}
});

export const useSession = () => useContext(SessionContext);

export const SessionProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uiLocale, setUiLocale] = useState(() => getResolvedLocale(i18n));

  const applyLocale = async (u) => {
    const uiLocale = getUserUiLocale(u);
    if (!uiLocale) return;

    setStoredLocale(uiLocale);

    try {
      await i18n.changeLanguage(uiLocale);
      setUiLocale(uiLocale);
    } catch (e) {
      // No rompemos bootstrap por un fallo de i18n
    }
  };

  const loadMe = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch('/users/me');

      setUser(data || null);
      await applyLocale(data);

      setLoading(false);
      return data || null;
    } catch (e) {
      const msg = String(e?.message || '');

      if (msg.includes('401')) {
        setUser(null);
      } else {
        // Si es error temporal, mantenemos el user anterior
      }

      setLoading(false);

      if (!msg.includes('401')) {
        setError(e);
      }

      return msg.includes('401') ? null : user;
    }
  };

  const updateUiLocale = async (nextLocale) => {
    const normalized = normalizeLocale(nextLocale);
    if (!normalized) {
      throw new Error('uiLocale no válido');
    }

    const isAuthenticated = !!user;

    if (!isAuthenticated) {
      setStoredLocale(normalized);

      try {
        await i18n.changeLanguage(normalized);
        setUiLocale(normalized);
      } catch (e) {
        // No rompemos por fallo de i18n
      }

      return null;
    }

    const updatedUser = await apiFetch('/users/me/ui-locale', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ uiLocale: normalized })
    });

    setUser(updatedUser || null);
    await applyLocale(updatedUser);

    return updatedUser || null;
  };

  useEffect(() => {
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    error,
    uiLocale,
    refresh: loadMe,
    updateUiLocale
  }), [user, loading, error, uiLocale]);


  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};