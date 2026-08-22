export const LOCALE_STORAGE_KEY = 'sharemechat.uiLocale';

export const FALLBACK_LOCALE = 'en';

// Locale por defecto (sin prefijo en la URL). El resto llevan prefijo /<locale>.
export const DEFAULT_LOCALE = 'es';

// Idiomas de UI (Nivel A): SOLO los que tenemos traducidos. Distinto del set de
// idiomas de chat (SupportedChatLanguages, backend), que es amplio. Ampliar aquí
// requiere su locale JSON + prefijo de URL + hreflang.
// Fase 1 (2026-08-20): fr, de. + pt (2026-08-21, cobertura América: ES+PT+EN,
// abre modelos de Brasil). Siguientes: it, nl, pl.
export const SUPPORTED_LOCALES = ['es', 'en', 'fr', 'de', 'pt'];

// Idiomas ofrecidos en el BACKOFFICE (admin). El backoffice NO se traduce más allá
// de es/en (decisión de producto, i18n-language-redesign-plan.md §"Solo producto"):
// ofrecer fr/de/pt aquí solo dejaría la UI en inglés por fallback → confuso. El
// selector limita a este set cuando isAdminSurface().
export const ADMIN_LOCALES = ['es', 'en'];

// Etiqueta corta (código) para el disparador del selector.
export const LOCALE_LABELS = SUPPORTED_LOCALES.reduce((acc, locale) => {
  acc[locale] = locale.toUpperCase();
  return acc;
}, {});

// Nombre nativo del idioma (lo que ve el usuario en la lista del selector).
export const LOCALE_NATIVE_NAMES = {
  es: 'Español',
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
};

// Selector con badge de código (no bandera emoji: degrada a letras
// desalineadas en Windows). El código va como badge estilado; el nombre nativo
// es el texto principal.
export const getLocaleLabel = (locale) => {
  return LOCALE_LABELS[locale] || String(locale || '').toUpperCase();
};

export const getLocaleNativeName = (locale) => {
  return LOCALE_NATIVE_NAMES[locale] || getLocaleLabel(locale);
};
