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
  const storedLocale = getStoredLocale();
  if (storedLocale) {
    return storedLocale;
  }

  const browserLocale = getBrowserLocale();
  if (browserLocale) {
    return browserLocale;
  }

  return FALLBACK_LOCALE;
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