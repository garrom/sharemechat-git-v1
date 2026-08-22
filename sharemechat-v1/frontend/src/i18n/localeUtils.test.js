// Fase 1/4 i18n — localeUtils: normalización, prefijos de URL, y getInitialLocale
// (la URL como fuente de verdad del locale activo, ADR-022).

import {
  normalizeLocale,
  isSupportedLocale,
  localePrefix,
  PREFIXED_LOCALES,
  getStoredLocale,
  setStoredLocale,
  getBrowserLocale,
  getInitialLocale,
  getResolvedLocale,
  getUserUiLocale,
  getAvailableLocales,
} from './localeUtils';
import { LOCALE_STORAGE_KEY } from './localeConfig';

let originalLocationDescriptor;

beforeAll(() => {
  originalLocationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
});
afterAll(() => {
  if (originalLocationDescriptor) Object.defineProperty(window, 'location', originalLocationDescriptor);
});

function setPath(pathname) {
  delete window.location;
  window.location = { pathname, search: '', hash: '', assign: jest.fn() };
}

beforeEach(() => {
  try { window.localStorage.clear(); } catch (e) { /* noop */ }
});

describe('normalizeLocale / isSupportedLocale', () => {
  test('acepta el set de UI, insensible a mayúsculas y región', () => {
    expect(normalizeLocale('es')).toBe('es');
    expect(normalizeLocale('EN')).toBe('en');
    expect(normalizeLocale('fr-FR')).toBe('fr');
    expect(normalizeLocale('de_DE')).toBe('de');
    expect(normalizeLocale('pt-BR')).toBe('pt');
  });

  test('rechaza idiomas de chat-only o desconocidos y nulos', () => {
    expect(normalizeLocale('it')).toBeNull(); // chat sí, UI no
    expect(normalizeLocale('mg')).toBeNull();
    expect(normalizeLocale('xx')).toBeNull();
    expect(normalizeLocale('')).toBeNull();
    expect(normalizeLocale(null)).toBeNull();
  });

  test('isSupportedLocale', () => {
    expect(isSupportedLocale('fr')).toBe(true);
    expect(isSupportedLocale('it')).toBe(false);
  });
});

describe('localePrefix / PREFIXED_LOCALES', () => {
  test('el default (es) va sin prefijo; el resto con /<locale>', () => {
    expect(localePrefix('es')).toBe('');
    expect(localePrefix('en')).toBe('/en');
    expect(localePrefix('fr')).toBe('/fr');
    expect(localePrefix('xx')).toBe(''); // no soportado -> sin prefijo
  });

  test('PREFIXED_LOCALES = soportados menos el default', () => {
    expect(PREFIXED_LOCALES).toEqual(['en', 'fr', 'de', 'pt']);
  });
});

describe('storage y navegador', () => {
  test('setStoredLocale normaliza y persiste; getStoredLocale lee', () => {
    expect(setStoredLocale('FR-fr')).toBe('fr');
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('fr');
    expect(getStoredLocale()).toBe('fr');
  });

  test('setStoredLocale con no soportado no persiste y devuelve null', () => {
    expect(setStoredLocale('it')).toBeNull();
    expect(getStoredLocale()).toBeNull();
  });

  test('getBrowserLocale normaliza navigator.language', () => {
    Object.defineProperty(window.navigator, 'language', { value: 'de-AT', configurable: true });
    expect(getBrowserLocale()).toBe('de');
    Object.defineProperty(window.navigator, 'language', { value: 'ja-JP', configurable: true });
    expect(getBrowserLocale()).toBeNull(); // ja no es idioma de UI
  });
});

describe('getInitialLocale (URL como fuente de verdad)', () => {
  test('sin prefijo -> default es', () => {
    setPath('/');
    expect(getInitialLocale()).toBe('es');
    setPath('/client');
    expect(getInitialLocale()).toBe('es');
  });

  test('/<locale> y /<locale>/... -> ese locale', () => {
    setPath('/en');
    expect(getInitialLocale()).toBe('en');
    setPath('/fr/perfil');
    expect(getInitialLocale()).toBe('fr');
    setPath('/pt');
    expect(getInitialLocale()).toBe('pt');
  });

  test('un path que empieza por el código pero no es segmento no cuenta', () => {
    setPath('/enterprise'); // no es /en ni /en/
    expect(getInitialLocale()).toBe('es');
  });
});

describe('getResolvedLocale / getUserUiLocale / getAvailableLocales', () => {
  test('getResolvedLocale usa resolvedLanguage, luego language, luego fallback', () => {
    expect(getResolvedLocale({ resolvedLanguage: 'en' })).toBe('en');
    expect(getResolvedLocale({ language: 'fr' })).toBe('fr');
    expect(getResolvedLocale({ resolvedLanguage: 'it' })).toBe('en'); // no soportado -> fallback
    expect(getResolvedLocale(null)).toBe('en');
  });

  test('getUserUiLocale lee uiLocale o ui_locale', () => {
    expect(getUserUiLocale({ uiLocale: 'de' })).toBe('de');
    expect(getUserUiLocale({ ui_locale: 'pt' })).toBe('pt');
    expect(getUserUiLocale(null)).toBeNull();
    expect(getUserUiLocale({ uiLocale: 'it' })).toBeNull();
  });

  test('getAvailableLocales devuelve una copia del set', () => {
    const a = getAvailableLocales();
    expect(a).toEqual(['es', 'en', 'fr', 'de', 'pt']);
    a.push('zz');
    expect(getAvailableLocales()).toEqual(['es', 'en', 'fr', 'de', 'pt']);
  });
});
