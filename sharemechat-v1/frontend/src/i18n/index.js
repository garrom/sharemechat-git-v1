import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import es from './locales/es.json';
import en from './locales/en.json';

import {
  FALLBACK_LOCALE,
  SUPPORTED_LOCALES
} from './localeConfig';
import {
  getInitialLocale
} from './localeUtils';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en }
    },
    lng: getInitialLocale(),
    fallbackLng: FALLBACK_LOCALE,
    supportedLngs: SUPPORTED_LOCALES,
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;