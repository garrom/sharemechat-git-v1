import {
  FALLBACK_LOCALE,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES
} from './localeConfig';

export const normalizeLocale = (value) => {
  if (!value) return null;

  const normalized = String(value).trim().toLowerCase();
  const short = normalized.split('-')[0].split('_')[0];

  if (SUPPORTED_LOCALES.includes(short)) {
    return short;
  }

  return null;
};

export const isSupportedLocale = (value) => {
  return !!normalizeLocale(value);
};

export const getStoredLocale = () => {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return normalizeLocale(stored);
  } catch (e) {
    return null;
  }
};

export const setStoredLocale = (locale) => {
  const normalized = normalizeLocale(locale);
  if (!normalized) return null;

  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, normalized);
  } catch (e) {
    // No rompemos flujo por localStorage
  }

  return normalized;
};

export const getBrowserLocale = () => {
  try {
    return normalizeLocale(navigator.language);
  } catch (e) {
    return null;
  }
};

export const getInitialLocale = () => {
  // Fase 4B.3 (ADR-022): la URL es la fuente de verdad estricta del locale
  // activo. Reglas:
  //   - /en | /en/*  -> 'en'
  //   - cualquier otro path -> 'es' (default sin prefijo)
  // localStorage y navigator.language siguen disponibles via getStoredLocale()
  // y getBrowserLocale() para uso por sub-fases posteriores (4B.6 / 4F:
  // banner sugerente, persistencia tras switch manual), pero NO determinan
  // el locale inicial. Sin esto, un navegador en EN viendo "/" tendria
  // chrome en EN y URLs sin prefijo /en/, inconsistente con ADR-022.
  if (typeof window !== 'undefined'
      && window.location
      && typeof window.location.pathname === 'string') {
    const path = window.location.pathname;
    if (path === '/en' || path.startsWith('/en/')) {
      return 'en';
    }
  }
  return 'es';
};

export const getResolvedLocale = (i18nInstance) => {
  if (!i18nInstance) return FALLBACK_LOCALE;

  return (
    normalizeLocale(i18nInstance.resolvedLanguage) ||
    normalizeLocale(i18nInstance.language) ||
    FALLBACK_LOCALE
  );
};

export const getUserUiLocale = (user) => {
  if (!user) return null;
  return normalizeLocale(user.uiLocale || user.ui_locale);
};

export const getAvailableLocales = () => {
  return [...SUPPORTED_LOCALES];
};