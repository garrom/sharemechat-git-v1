// Fase 1 i18n — localeConfig: set de idiomas de UI (Nivel A) y helpers de label.
// Debe ir en paralelo con backend constants/SupportedUiLocales.

import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  LOCALE_STORAGE_KEY,
  LOCALE_LABELS,
  LOCALE_NATIVE_NAMES,
  getLocaleLabel,
  getLocaleNativeName,
} from './localeConfig';

describe('localeConfig', () => {
  test('el set de UI es exactamente es/en/fr/de/pt', () => {
    expect(SUPPORTED_LOCALES).toEqual(['es', 'en', 'fr', 'de', 'pt']);
  });

  test('constantes base', () => {
    expect(DEFAULT_LOCALE).toBe('es');
    expect(FALLBACK_LOCALE).toBe('en');
    expect(LOCALE_STORAGE_KEY).toBe('sharemechat.uiLocale');
  });

  test('LOCALE_LABELS son el código en mayúsculas para cada locale', () => {
    SUPPORTED_LOCALES.forEach((l) => {
      expect(LOCALE_LABELS[l]).toBe(l.toUpperCase());
    });
  });

  test('LOCALE_NATIVE_NAMES cubre todos los locales soportados', () => {
    SUPPORTED_LOCALES.forEach((l) => {
      expect(typeof LOCALE_NATIVE_NAMES[l]).toBe('string');
      expect(LOCALE_NATIVE_NAMES[l].length).toBeGreaterThan(0);
    });
    expect(LOCALE_NATIVE_NAMES.es).toBe('Español');
    expect(LOCALE_NATIVE_NAMES.pt).toBe('Português');
  });

  test('getLocaleLabel: conocido -> label; desconocido -> mayúsculas; nulo -> ""', () => {
    expect(getLocaleLabel('en')).toBe('EN');
    expect(getLocaleLabel('zz')).toBe('ZZ');
    expect(getLocaleLabel(null)).toBe('');
  });

  test('getLocaleNativeName: conocido -> nombre nativo; desconocido -> cae a label', () => {
    expect(getLocaleNativeName('fr')).toBe('Français');
    expect(getLocaleNativeName('zz')).toBe('ZZ');
  });
});
