import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterModelModalContent from './RegisterModelModalContent';
import { apiFetch } from '../config/http';
import { pushSignUp } from '../utils/attribution';

/**
 * ADR-059 Fase 4 (frontend): formulario de registro de MODELO
 * (`RegisterModelModalContent`) — el flujo de captación (cuello de botella del
 * proyecto). Variante del registro de cliente con un campo extra `dateOfBirth`
 * requerido y POST a `/users/register/model`.
 *
 * i18n mockeado (`t: k => k`, aserciones por CLAVE) + deps con efectos (apiFetch,
 * modal, atribución). Cubre: validación (incl. fecha de nacimiento), gates
 * 18+/términos, submit feliz (apiFetch con dateOfBirth en el body + cierre) y
 * error de backend.
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
  nickname: 'auth.registerModel.placeholders.nickname',
  email: 'auth.registerModel.placeholders.email',
  password: 'auth.registerModel.placeholders.password',
};
const DOB_LABEL = 'auth.registerModel.labels.dateOfBirth';

async function fillValid(user) {
  await user.type(screen.getByPlaceholderText(PH.nickname), 'modelita');
  await user.type(screen.getByPlaceholderText(PH.email), 'model@example.com');
  await user.type(screen.getByPlaceholderText(PH.password), 'password123');
  fireEvent.change(screen.getByLabelText(DOB_LABEL), { target: { value: '1995-05-20' } });
}

const submitBtn = () => screen.getByRole('button', { name: 'auth.registerModel.actions.submit' });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RegisterModelModalContent', () => {
  test('campos vacíos: errores de validación (incl. fecha) y no llama a apiFetch', async () => {
    const user = userEvent.setup();
    render(<RegisterModelModalContent onClose={jest.fn()} />);

    await user.click(submitBtn());

    expect(screen.getByText('auth.registerModel.validation.nicknameRequired')).toBeInTheDocument();
    expect(screen.getByText('auth.registerModel.validation.emailRequired')).toBeInTheDocument();
    expect(screen.getByText('auth.registerModel.validation.passwordMin')).toBeInTheDocument();
    expect(screen.getByText('auth.registerModel.validation.dateOfBirthRequired')).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  test('sin marcar 18+: bloquea con error confirmAdult', async () => {
    const user = userEvent.setup();
    render(<RegisterModelModalContent onClose={jest.fn()} />);

    await fillValid(user);
    await user.click(submitBtn());

    expect(screen.getByRole('alert')).toHaveTextContent('auth.registerModel.validation.confirmAdult');
    expect(apiFetch).not.toHaveBeenCalled();
  });

  test('18+ marcado pero sin aceptar términos: bloquea con error acceptTerms', async () => {
    const user = userEvent.setup();
    render(<RegisterModelModalContent onClose={jest.fn()} />);

    await fillValid(user);
    const [over18] = screen.getAllByRole('checkbox');
    await user.click(over18);
    await user.click(submitBtn());

    expect(screen.getByRole('alert')).toHaveTextContent('auth.registerModel.validation.acceptTerms');
    expect(apiFetch).not.toHaveBeenCalled();
  });

  test('todo válido: llama a apiFetch (/users/register/model) con dateOfBirth y cierra', async () => {
    apiFetch.mockResolvedValue({});
    const onClose = jest.fn();
    const user = userEvent.setup();
    render(<RegisterModelModalContent onClose={onClose} />);

    await fillValid(user);
    const [over18, terms] = screen.getAllByRole('checkbox');
    await user.click(over18);
    await user.click(terms);
    await user.click(submitBtn());

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    const [url, opts] = apiFetch.mock.calls[0];
    expect(url).toBe('/users/register/model');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body.email).toBe('model@example.com');
    expect(body.password).toBe('password123');
    expect(body.dateOfBirth).toBe('1995-05-20');
    expect(body.confirAdult).toBe(true);
    expect(body.acceptedTerm).toBe(true);

    expect(pushSignUp).toHaveBeenCalledWith({ userType: 'model' });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  test('error de backend: muestra mensaje y no cierra', async () => {
    apiFetch.mockRejectedValue(new Error('boom'));
    const onClose = jest.fn();
    const user = userEvent.setup();
    render(<RegisterModelModalContent onClose={onClose} />);

    await fillValid(user);
    const [over18, terms] = screen.getAllByRole('checkbox');
    await user.click(over18);
    await user.click(terms);
    await user.click(submitBtn());

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('ERROR_BACKEND'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
