// Fase 3 i18n — LanguageSuggestionBanner: banner sugerente "sin imponer". Solo
// para NO logueados, cuando el idioma del navegador es un idioma de UI distinto
// del actual, fuera del blog y no descartado.

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LanguageSuggestionBanner from './LanguageSuggestionBanner';
import i18n from '../i18n';
import { useSession } from './SessionProvider';

jest.mock('../i18n', () => ({
  __esModule: true,
  default: {
    t: (k, opt) => {
      let s = (opt && opt.defaultValue) || k;
      if (opt && opt.lang) s = s.replace('{{lang}}', opt.lang);
      return s;
    },
    resolvedLanguage: 'es',
    language: 'es',
  },
}));
jest.mock('./SessionProvider', () => ({ useSession: jest.fn() }));

const DISMISS_KEY = 'sharemechat.langSuggestDismissed';

let loc;
let originalLocationDescriptor;

beforeAll(() => {
  originalLocationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
});
afterAll(() => {
  if (originalLocationDescriptor) Object.defineProperty(window, 'location', originalLocationDescriptor);
});

function setPath(pathname) {
  loc = { pathname, search: '', hash: '', assign: jest.fn() };
  delete window.location;
  window.location = loc;
}
function setBrowserLang(l) {
  Object.defineProperty(window.navigator, 'language', { value: l, configurable: true });
}

beforeEach(() => {
  jest.clearAllMocks();
  try { window.localStorage.clear(); } catch (e) { /* noop */ }
  i18n.resolvedLanguage = 'es';
  useSession.mockReturnValue({ user: null });
  setPath('/');
  setBrowserLang('fr');
});

test('no muestra nada si el idioma del navegador coincide con el actual', () => {
  setBrowserLang('es'); // sugerido == actual (es)
  render(<LanguageSuggestionBanner />);
  expect(screen.queryByRole('region')).toBeNull();
});

test('no muestra nada para usuarios logueados', () => {
  useSession.mockReturnValue({ user: { id: 1 } });
  render(<LanguageSuggestionBanner />);
  expect(screen.queryByRole('region')).toBeNull();
});

test('no muestra nada si el idioma del navegador no es de UI (p. ej. italiano)', () => {
  setBrowserLang('it');
  render(<LanguageSuggestionBanner />);
  expect(screen.queryByRole('region')).toBeNull();
});

test('no muestra nada en rutas del blog', () => {
  setPath('/blog');
  render(<LanguageSuggestionBanner />);
  expect(screen.queryByRole('region')).toBeNull();
});

test('muestra el banner cuando navegador=fr y actual=es (no logueado)', () => {
  render(<LanguageSuggestionBanner />);
  expect(screen.getByRole('region', { name: 'Sugerencia de idioma' })).toBeInTheDocument();
  expect(screen.getByText(/Français/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Cambiar' })).toBeInTheDocument();
});

test('descartar recuerda el idioma y oculta el banner', () => {
  render(<LanguageSuggestionBanner />);
  fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
  expect(window.localStorage.getItem(DISMISS_KEY)).toBe('fr');
  expect(screen.queryByRole('region')).toBeNull();
});

test('no muestra si ya estaba descartado ese idioma', () => {
  window.localStorage.setItem(DISMISS_KEY, 'fr');
  render(<LanguageSuggestionBanner />);
  expect(screen.queryByRole('region')).toBeNull();
});

test('cambiar navega al path con prefijo del idioma sugerido', () => {
  setPath('/client');
  render(<LanguageSuggestionBanner />);
  fireEvent.click(screen.getByRole('button', { name: 'Cambiar' }));
  expect(loc.assign).toHaveBeenCalledWith('/fr/client');
});
