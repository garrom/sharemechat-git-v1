export const LOCALE_STORAGE_KEY = 'sharemechat.uiLocale';

export const FALLBACK_LOCALE = 'en';

export const SUPPORTED_LOCALES = ['es','en'];

export const LOCALE_LABELS = SUPPORTED_LOCALES.reduce((acc,locale)=>{
  acc[locale]=locale.toUpperCase();
  return acc;
},{});

export const getLocaleLabel = (locale)=>{
  return LOCALE_LABELS[locale]||locale.toUpperCase();
};
