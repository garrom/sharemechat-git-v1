import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES
} from './localeConfig';

// Locales que llevan prefijo en la URL (todos menos el default, que va sin prefijo).
export const PREFIXED_LOCALES = SUPPORTED_LOCALES.filter((l) => l !== DEFAULT_LOCALE);

// Prefijo de URL para un locale: '' para el default (es), '/en' '/fr' '/de' resto.
export const localePrefix = (locale) => {
  const norm = normalizeLocale(locale);
  return norm && norm !== DEFAULT_LOCALE ? `/${norm}` : '';
};

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
  // activo. Reglas (generalizado a N idiomas en Fase 1 i18n, 2026-08-20):
  //   - /<locale> | /<locale>/*  -> ese locale (para cada locale != default)
  //   - cualquier otro path       -> DEFAULT_LOCALE ('es', sin prefijo)
  // localStorage y navigator.language siguen disponibles via getStoredLocale()
  // y getBrowserLocale() para el banner sugerente, pero NO determinan el locale
  // inicial. Sin esto, un navegador en otro idioma viendo "/" tendria chrome
  // en ese idioma y URLs sin prefijo, inconsistente con ADR-022.
  if (typeof window !== 'undefined'
      && window.location
      && typeof window.location.pathname === 'string') {
    const path = window.location.pathname;
    for (const locale of PREFIXED_LOCALES) {
      if (path === `/${locale}` || path.startsWith(`/${locale}/`)) {
        return locale;
      }
    }
  }
  return DEFAULT_LOCALE;
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