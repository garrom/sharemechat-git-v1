// ADR-059 Fase 4 — LocaleSwitcher: cambio de idioma. En producto el idioma
// MOSTRADO lo decide la URL (ADR-022, basename /en); la preferencia se PERSISTE
// (updateUiLocale) para emails. En rutas de blog hay lógica dedicada por
// alternates (ADR-025). Se testea la construcción de URL y el enrutado.

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LocaleSwitcher from './LocaleSwitcher';
import { useSession } from './SessionProvider';
import { useBlogLocale } from '../pages/blog/BlogLocaleContext';
import { getResolvedLocale, getAvailableLocales } from '../i18n/localeUtils';
import { isAdminSurface } from '../utils/runtimeSurface';

jest.mock('../i18n', () => ({ __esModule: true, default: { t: (k) => k } }));
jest.mock('./SessionProvider', () => ({ useSession: jest.fn() }));
jest.mock('../pages/blog/BlogLocaleContext', () => ({ useBlogLocale: jest.fn() }));
jest.mock('../i18n/localeUtils', () => ({
  getResolvedLocale: jest.fn(() => 'es'),
  getAvailableLocales: jest.fn(() => ['es', 'en']),
  // Selector dropdown (Fase 1 i18n): prefijos de URL generalizados.
  PREFIXED_LOCALES: ['en', 'fr', 'de'],
  localePrefix: (l) => (l && l !== 'es' ? `/${l}` : ''),
}));
jest.mock('../i18n/localeConfig', () => ({
  LOCALE_LABELS: { es: 'ES', en: 'EN' },
  getLocaleNativeName: (l) => ({ es: 'Español', en: 'English' }[l] || l),
  getLocaleLabel: (l) => ({ es: 'ES', en: 'EN' }[l] || l),
  ADMIN_LOCALES: ['es', 'en'],
}));
jest.mock('../utils/runtimeSurface', () => ({ isAdminSurface: jest.fn(() => false) }));

let updateUiLocale;
let assignSpy;
let loc;
let originalLocationDescriptor;

// Muta el objeto location mockeado (creado en beforeEach); no re-defineProperty
// por test para evitar corromper window.location entre tests.
function setLocation(pathname, { search = '', hash = '' } = {}) {
  loc.pathname = pathname;
  loc.search = search;
  loc.hash = hash;
}

beforeAll(() => {
  originalLocationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
});

afterAll(() => {
  if (originalLocationDescriptor) Object.defineProperty(window, 'location', originalLocationDescriptor);
});

beforeEach(() => {
  jest.clearAllMocks();
  updateUiLocale = jest.fn().mockResolvedValue(undefined);
  useSession.mockReturnValue({ updateUiLocale, user: { id: 1 } });
  useBlogLocale.mockReturnValue(null);
  getResolvedLocale.mockReturnValue('es');
  getAvailableLocales.mockReturnValue(['es', 'en']); // CRA resetea mocks entre tests
  isAdminSurface.mockReturnValue(false);

  assignSpy = jest.fn();
  loc = { pathname: '/', search: '', hash: '', assign: assignSpy };
  delete window.location;
  window.location = loc;
});

// El selector es un dropdown: primero abrir (trigger, aria-label 'Idioma' -> el
// mock de i18n.t devuelve la clave 'common.locale.label'), luego clicar la opción
// (role=option; su nombre accesible es "<nativo> <código>", p.ej. "English EN").
const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'common.locale.label' }));
const clickLocale = (nameRegex) => {
  openMenu();
  fireEvent.click(screen.getByRole('option', { name: nameRegex }));
};

test('clicar el idioma actual -> no-op (ni persiste ni navega)', async () => {
  setLocation('/client');
  render(<LocaleSwitcher />);
  clickLocale(/Español/); // ya es el actual (es)
  await Promise.resolve();
  expect(updateUiLocale).not.toHaveBeenCalled();
  expect(assignSpy).not.toHaveBeenCalled();
});

test('producto: es->en desde /client -> persiste y navega a /en/client', async () => {
  setLocation('/client');
  render(<LocaleSwitcher />);
  clickLocale(/English/);
  await waitFor(() => expect(updateUiLocale).toHaveBeenCalledWith('en'));
  await waitFor(() => expect(assignSpy).toHaveBeenCalledWith('/en/client'));
});

test('producto: es->en desde / (home) -> /en', async () => {
  setLocation('/');
  render(<LocaleSwitcher />);
  clickLocale(/English/);
  await waitFor(() => expect(assignSpy).toHaveBeenCalledWith('/en'));
});

test('producto: en->es desde /en/client -> quita el basename -> /client', async () => {
  getResolvedLocale.mockReturnValue('en');
  setLocation('/en/client');
  render(<LocaleSwitcher />);
  clickLocale(/Español/);
  await waitFor(() => expect(assignSpy).toHaveBeenCalledWith('/client'));
});

test('producto: conserva search y hash al navegar', async () => {
  setLocation('/client', { search: '?a=1', hash: '#x' });
  render(<LocaleSwitcher />);
  clickLocale(/English/);
  await waitFor(() => expect(assignSpy).toHaveBeenCalledWith('/en/client?a=1#x'));
});

test('público (sin user): NO persiste pero sí navega', async () => {
  useSession.mockReturnValue({ updateUiLocale, user: null });
  setLocation('/client');
  render(<LocaleSwitcher />);
  clickLocale(/English/);
  await waitFor(() => expect(assignSpy).toHaveBeenCalledWith('/en/client'));
  expect(updateUiLocale).not.toHaveBeenCalled();
});

test('admin surface: persiste + onAfterChange, sin navegación por URL', async () => {
  isAdminSurface.mockReturnValue(true);
  setLocation('/dashboard-admin');
  const onAfterChange = jest.fn();
  render(<LocaleSwitcher onAfterChange={onAfterChange} />);
  clickLocale(/English/);
  await waitFor(() => expect(updateUiLocale).toHaveBeenCalledWith('en'));
  expect(onAfterChange).toHaveBeenCalledWith('en');
  expect(assignSpy).not.toHaveBeenCalled();
});

test('admin surface: solo ofrece es/en aunque el producto tenga 5 idiomas', () => {
  isAdminSurface.mockReturnValue(true);
  getAvailableLocales.mockReturnValue(['es', 'en', 'fr', 'de', 'pt']); // set de producto
  setLocation('/dashboard-admin');
  render(<LocaleSwitcher />);
  openMenu();
  const options = screen.getAllByRole('option');
  expect(options).toHaveLength(2); // el backoffice NO ofrece fr/de/pt
  expect(screen.getByRole('option', { name: /Español/ })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: /English/ })).toBeInTheDocument();
});

// Guard de sesión activa (streaming/llamada): el cambio de idioma navega con
// recarga completa y rompería la comunicación. Los dashboards pasan
// confirmarSalidaSesionActiva como `guard`; si bloquea (false), no se navega.
describe('guard de sesión activa', () => {
  test('guard bloquea (sesión activa) -> ni persiste ni navega', async () => {
    const guard = jest.fn().mockResolvedValue(false);
    setLocation('/client');
    render(<LocaleSwitcher guard={guard} />);
    clickLocale(/English/);
    await waitFor(() => expect(guard).toHaveBeenCalled());
    expect(updateUiLocale).not.toHaveBeenCalled();
    expect(assignSpy).not.toHaveBeenCalled();
  });

  test('guard permite (sin sesión) -> navega normal', async () => {
    const guard = jest.fn().mockResolvedValue(true);
    setLocation('/client');
    render(<LocaleSwitcher guard={guard} />);
    clickLocale(/English/);
    await waitFor(() => expect(assignSpy).toHaveBeenCalledWith('/en/client'));
    expect(guard).toHaveBeenCalled();
  });

  test('sin guard -> comportamiento normal (navega)', async () => {
    setLocation('/client');
    render(<LocaleSwitcher />);
    clickLocale(/English/);
    await waitFor(() => expect(assignSpy).toHaveBeenCalledWith('/en/client'));
  });
});

describe('rutas de blog (ADR-025)', () => {
  test('detalle con alternate publicado -> salta al slug equivalente', async () => {
    useBlogLocale.mockReturnValue({
      currentLocale: 'es',
      currentSlug: 'mi-articulo',
      alternates: [{ locale: 'en', url: 'https://x/blog/en/my-article' }],
    });
    setLocation('/blog/es/mi-articulo');
    render(<LocaleSwitcher />);
    clickLocale(/English/);
    await waitFor(() => expect(assignSpy).toHaveBeenCalledWith('https://x/blog/en/my-article'));
    expect(updateUiLocale).not.toHaveBeenCalled(); // el blog no pasa por persistencia
  });

  test('detalle sin alternate para el locale destino -> botón deshabilitado', () => {
    useBlogLocale.mockReturnValue({
      currentLocale: 'es',
      currentSlug: 'solo-es',
      alternates: [], // no hay EN
    });
    setLocation('/blog/es/solo-es');
    render(<LocaleSwitcher />);
    openMenu();
    expect(screen.getByRole('option', { name: /English/ })).toBeDisabled();
  });
});
