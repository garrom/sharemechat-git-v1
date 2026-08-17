import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ModelLanding from './ModelLanding';

/**
 * Área pública de captación de MODELOS (Opción B): landing /modelos con entrada
 * PROPIA de registro. La invariante de negocio/seguridad que se testea: el CTA
 * abre DIRECTO el registro de modelo (register-model), sin el selector
 * hombre/mujer retirado, y en contexto audience='model' (que oculta el login
 * de Google en el modal). Además la foto del hero se sirve desde el CDN de
 * assets (ASSETS_BASE), no embebida en base64 (patrón de las páginas públicas).
 *
 * Se aíslan las dependencias de chrome (Seo, PublicNavbar) y se mockea i18n
 * (`t: k => k`) y useAppModals para capturar la llamada. react-router real vía
 * MemoryRouter (el componente usa useHistory).
 */

const mockOpenLoginModal = jest.fn();

jest.mock('../i18n', () => ({ __esModule: true, default: { t: (k) => k } }));
jest.mock('../config/runtimeEnv', () => ({ ASSETS_BASE: 'https://assets.example.test' }));
jest.mock('../components/Seo', () => ({ __esModule: true, default: () => null }));
jest.mock('../components/navbar/PublicNavbar', () => ({ __esModule: true, default: () => null }));
jest.mock('../components/useAppModals', () => ({
  __esModule: true,
  default: () => ({ openLoginModal: mockOpenLoginModal }),
}));

const renderLanding = () =>
  render(
    <MemoryRouter initialEntries={['/modelos']}>
      <ModelLanding />
    </MemoryRouter>,
  );

beforeEach(() => jest.clearAllMocks());

describe('ModelLanding (/modelos)', () => {
  test('CTA del hero abre el registro de MODELO directo (audience=model), sin selector género', () => {
    renderLanding();
    fireEvent.click(screen.getByRole('button', { name: 'modelLanding.hero.cta' }));
    expect(mockOpenLoginModal).toHaveBeenCalledTimes(1);
    expect(mockOpenLoginModal).toHaveBeenCalledWith({ initialView: 'register-model', audience: 'model' });
  });

  test('CTA final también dispara register-model en contexto modelo', () => {
    renderLanding();
    fireEvent.click(screen.getByRole('button', { name: 'modelLanding.ctaFinal.cta' }));
    expect(mockOpenLoginModal).toHaveBeenCalledWith({ initialView: 'register-model', audience: 'model' });
  });

  test('la foto del hero se sirve desde ASSETS_BASE (CDN), no base64', () => {
    renderLanding();
    const img = screen.getByAltText('modelLanding.hero.imageAlt');
    expect(img.getAttribute('src')).toBe('https://assets.example.test/models/chica-corazon.png');
    expect(img.getAttribute('src')).not.toMatch(/^data:/);
  });
});
