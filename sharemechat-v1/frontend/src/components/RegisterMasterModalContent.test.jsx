import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterMasterModalContent from './RegisterMasterModalContent';
import { apiFetch } from '../config/http';
import { pushSignUp } from '../utils/attribution';

/**
 * ADR-059 Fase 4 (frontend): formulario de registro MASTER
 * (`RegisterMasterModalContent`, ADR-056 S5.b). El más rico de los tres: password
 * mínimo 10 (no 8), fecha de nacimiento que debe ser PASADA, y campos de empresa
 * opcionales (companyName/RegistrationNumber/Country; el país 2 letras, se envía
 * en MAYÚSCULAS). POST a `/masters/register`.
 *
 * i18n mockeado (`t: k => k`) + deps con efectos. Cubre: validación vacíos,
 * password < 10, fecha futura, país de empresa mal formado, submit feliz con
 * campos de empresa (país uppercased), y error de backend.
 */

jest.mock('../config/http', () => ({ apiFetch: jest.fn() }));
jest.mock('../i18n', () => ({ __esModule: true, default: { t: (k) => k } }));
jest.mock('../i18n/localeUtils', () => ({ getResolvedLocale: () => 'es' }));
jest.mock('../i18n/registerErrorMessage', () => ({ registerErrorMessage: () => 'ERROR_BACKEND' }));
jest.mock('./useAppModals', () => ({
  useAppModals: () => ({ alert: jest.fn().mockResolvedValue(undefined) }),
}));
jest.mock('../utils/attribution', () => ({ pushSignUp: jest.fn(), getAcquisitionPayload: () => null }));
jest.mock('./InfoTooltip', () => ({ __esModule: true, default: ({ children }) => children }));

const PH = {
  email: 'auth.registerMaster.placeholders.email',
  password: 'auth.registerMaster.placeholders.password',
  nickname: 'auth.registerMaster.placeholders.nickname',
  companyName: 'auth.registerMaster.placeholders.companyName',
  companyCountry: 'auth.registerMaster.placeholders.companyCountry',
};
const DOB_LABEL = 'auth.registerMaster.labels.dateOfBirth';

async function fillPersonal(user, { password = 'password12', dob = '1990-01-01' } = {}) {
  await user.type(screen.getByPlaceholderText(PH.email), 'master@example.com');
  await user.type(screen.getByPlaceholderText(PH.password), password);
  await user.type(screen.getByPlaceholderText(PH.nickname), 'masterco');
  fireEvent.change(screen.getByLabelText(DOB_LABEL), { target: { value: dob } });
}

const submitBtn = () => screen.getByRole('button', { name: 'auth.registerMaster.actions.submit' });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RegisterMasterModalContent', () => {
  test('campos vacíos: errores de validación y no llama a apiFetch', async () => {
    const user = userEvent.setup();
    render(<RegisterMasterModalContent onClose={jest.fn()} />);

    await user.click(submitBtn());

    expect(screen.getByText('auth.registerMaster.validation.emailRequired')).toBeInTheDocument();
    expect(screen.getByText('auth.registerMaster.validation.passwordMin')).toBeInTheDocument();
    expect(screen.getByText('auth.registerMaster.validation.nicknameRequired')).toBeInTheDocument();
    expect(screen.getByText('auth.registerMaster.validation.dateOfBirthRequired')).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  test('password de menos de 10 caracteres: error passwordMin', async () => {
    const user = userEvent.setup();
    render(<RegisterMasterModalContent onClose={jest.fn()} />);

    await fillPersonal(user, { password: '123456789' }); // 9 chars
    await user.click(submitBtn());

    expect(screen.getByText('auth.registerMaster.validation.passwordMin')).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  test('fecha de nacimiento futura: error dateOfBirthPast', async () => {
    const user = userEvent.setup();
    render(<RegisterMasterModalContent onClose={jest.fn()} />);

    await fillPersonal(user, { dob: '2999-01-01' });
    await user.click(submitBtn());

    expect(screen.getByText('auth.registerMaster.validation.dateOfBirthPast')).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  test('país de empresa mal formado: error companyCountryFormat', async () => {
    const user = userEvent.setup();
    render(<RegisterMasterModalContent onClose={jest.fn()} />);

    await fillPersonal(user);
    // 'E1' = 2 chars (respeta maxLength) pero no son 2 letras -> falla el formato.
    await user.type(screen.getByPlaceholderText(PH.companyCountry), 'E1');
    await user.click(submitBtn());

    expect(screen.getByText('auth.registerMaster.validation.companyCountryFormat')).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  test('todo válido con empresa: llama a /masters/register con país en mayúsculas y cierra', async () => {
    apiFetch.mockResolvedValue({});
    const onClose = jest.fn();
    const user = userEvent.setup();
    render(<RegisterMasterModalContent onClose={onClose} />);

    await fillPersonal(user);
    await user.type(screen.getByPlaceholderText(PH.companyName), 'Estudio X');
    await user.type(screen.getByPlaceholderText(PH.companyCountry), 'es');
    const [over18, terms] = screen.getAllByRole('checkbox');
    await user.click(over18);
    await user.click(terms);
    await user.click(submitBtn());

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    const [url, opts] = apiFetch.mock.calls[0];
    expect(url).toBe('/masters/register');
    const body = JSON.parse(opts.body);
    expect(body.email).toBe('master@example.com');
    expect(body.password).toBe('password12');
    expect(body.dateOfBirth).toBe('1990-01-01');
    expect(body.companyName).toBe('Estudio X');
    expect(body.companyCountry).toBe('ES'); // uppercased
    expect(body.confirAdult).toBe(true);
    expect(body.acceptedTerm).toBe(true);

    expect(pushSignUp).toHaveBeenCalledWith({ userType: 'master' });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  test('error de backend: muestra mensaje y no cierra', async () => {
    apiFetch.mockRejectedValue(new Error('boom'));
    const onClose = jest.fn();
    const user = userEvent.setup();
    render(<RegisterMasterModalContent onClose={onClose} />);

    await fillPersonal(user);
    const [over18, terms] = screen.getAllByRole('checkbox');
    await user.click(over18);
    await user.click(terms);
    await user.click(submitBtn());

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('ERROR_BACKEND'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
