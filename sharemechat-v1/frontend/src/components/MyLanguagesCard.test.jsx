// Fase 2 i18n — MyLanguagesCard: selector single-select del idioma personal
// (Nivel B). Carga los idiomas soportados, muestra el primario del usuario y
// persiste vía PUT /me/languages con [{ langCode, primary:true }].

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MyLanguagesCard from './MyLanguagesCard';
import { useSession } from './SessionProvider';
import { getTranslationConfig, updateMyLanguages } from '../api/translationApi';

jest.mock('../i18n', () => ({ __esModule: true, default: { t: (k) => k } }));
jest.mock('./SessionProvider', () => ({ useSession: jest.fn() }));
jest.mock('../api/translationApi', () => ({
  getTranslationConfig: jest.fn(),
  updateMyLanguages: jest.fn(),
}));

let refresh;

beforeEach(() => {
  jest.clearAllMocks();
  refresh = jest.fn().mockResolvedValue(undefined);
  useSession.mockReturnValue({
    user: { languages: [{ langCode: 'en', primary: true }], uiLocale: 'en' },
    refresh,
  });
  getTranslationConfig.mockResolvedValue({ langs: ['es', 'en', 'fr'] });
  updateMyLanguages.mockResolvedValue({});
});

test('carga los idiomas y preselecciona el primario del usuario', async () => {
  render(<MyLanguagesCard />);
  const select = await screen.findByLabelText('myLanguages.title');
  expect(select.value).toBe('en');
  expect(screen.getByRole('option', { name: 'Español' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Français' })).toBeInTheDocument();
});

test('no renderiza nada si no hay idiomas soportados', async () => {
  getTranslationConfig.mockResolvedValue({ langs: [] });
  render(<MyLanguagesCard />);
  await waitFor(() => expect(getTranslationConfig).toHaveBeenCalled());
  expect(screen.queryByRole('combobox')).toBeNull();
});

test('cambiar idioma persiste [{langCode, primary:true}], refresca y muestra OK', async () => {
  render(<MyLanguagesCard />);
  const select = await screen.findByLabelText('myLanguages.title');

  fireEvent.change(select, { target: { value: 'fr' } });

  await waitFor(() => expect(updateMyLanguages).toHaveBeenCalledWith([{ langCode: 'fr', primary: true }]));
  await waitFor(() => expect(refresh).toHaveBeenCalled());
  expect(await screen.findByRole('status')).toHaveTextContent('myLanguages.savedOk');
});

test('si el guardado falla, muestra el error', async () => {
  updateMyLanguages.mockRejectedValue(new Error('boom'));
  render(<MyLanguagesCard />);
  const select = await screen.findByLabelText('myLanguages.title');

  fireEvent.change(select, { target: { value: 'es' } });

  expect(await screen.findByRole('alert')).toHaveTextContent('boom');
});
