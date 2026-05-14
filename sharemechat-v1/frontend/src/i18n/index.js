import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import es from './locales/es.json';
import en from './locales/en.json';

// Fase 4B.1 (ADR-022): namespace 'blog' separado del monolitico
// 'translation'. Cargado tambien por import estatico para mantener el
// patron actual (sin i18next-http-backend ni carga lazy). Los componentes
// del blog consumen este namespace con t('blog:hero.kicker'), etc.
import blogEs from './locales/blog/es.json';
import blogEn from './locales/blog/en.json';

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
      es: { translation: es, blog: blogEs },
      en: { translation: en, blog: blogEn }
    },
    ns: ['translation', 'blog'],
    defaultNS: 'translation',
    fallbackNS: 'translation',
    lng: getInitialLocale(),
    fallbackLng: FALLBACK_LOCALE,
    supportedLngs: SUPPORTED_LOCALES,
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
