import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterClientModalContent from './RegisterClientModalContent';
import { apiFetch } from '../config/http';
import { pushSignUp } from '../utils/attribution';

/**
 * ADR-059 Fase 4 (frontend): tests del formulario de registro de cliente
 * (`RegisterClientModalContent`). Primer test de componente del core con RTL.
 *
 * Se mockea i18n (`t: k => k`, así las aserciones usan las CLAVES y no se acoplan
 * al copy ES) y las dependencias con efectos (apiFetch de red, modal de éxito,
 * atribución GA4). Cubre: validación de campos vacíos, los gates 18+ y términos,
 * el submit feliz (llama a `apiFetch` con el body correcto + cierra), y el error
 * de backend (muestra mensaje, no cierra).
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
  nickname: 'auth.registerClient.placeholders.nickname',
  email: 'auth.registerClient.placeholders.email',
  password: 'auth.registerClient.placeholders.password',
};

async function fillValid(user) {
  await user.type(screen.getByPlaceholderText(PH.nickname), 'juanito');
  await user.type(screen.getByPlaceholderText(PH.email), 'juan@example.com');
  await user.type(screen.getByPlaceholderText(PH.password), 'password123');
}

const submitBtn = () => screen.getByRole('button', { name: 'auth.registerClient.actions.submit' });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RegisterClientModalContent', () => {
  test('campos vacíos: muestra errores de validación y no llama a apiFetch', async () => {
    const user = userEvent.setup();
    render(<RegisterClientModalContent onClose={jest.fn()} />);

    await user.click(submitBtn());

    expect(screen.getByText('auth.registerClient.validation.nicknameRequired')).toBeInTheDocument();
    expect(screen.getByText('auth.registerClient.validation.emailRequired')).toBeInTheDocument();
    expect(screen.getByText('auth.registerClient.validation.passwordMin')).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  test('sin marcar 18+: bloquea con error confirmAdult', async () => {
    const user = userEvent.setup();
    render(<RegisterClientModalContent onClose={jest.fn()} />);

    await fillValid(user);
    await user.click(submitBtn());

    expect(screen.getByRole('alert')).toHaveTextContent('auth.registerClient.validation.confirmAdult');
    expect(apiFetch).not.toHaveBeenCalled();
  });

  test('18+ marcado pero sin aceptar términos: bloquea con error acceptTerms', async () => {
    const user = userEvent.setup();
    render(<RegisterClientModalContent onClose={jest.fn()} />);

    await fillValid(user);
    const [over18] = screen.getAllByRole('checkbox');
    await user.click(over18); // marca 18+, deja términos sin marcar
    await user.click(submitBtn());

    expect(screen.getByRole('alert')).toHaveTextContent('auth.registerClient.validation.acceptTerms');
    expect(apiFetch).not.toHaveBeenCalled();
  });

  test('todo válido: llama a apiFetch con el body correcto y cierra', async () => {
    apiFetch.mockResolvedValue({});
    const onClose = jest.fn();
    const user = userEvent.setup();
    render(<RegisterClientModalContent onClose={onClose} />);

    await fillValid(user);
    const [over18, terms] = screen.getAllByRole('checkbox');
    await user.click(over18);
    await user.click(terms);
    await user.click(submitBtn());

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    const [url, opts] = apiFetch.mock.calls[0];
    expect(url).toBe('/users/register/client');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body.email).toBe('juan@example.com');
    expect(body.password).toBe('password123');
    expect(body.confirAdult).toBe(true);
    expect(body.acceptedTerm).toBe(true);

    expect(pushSignUp).toHaveBeenCalledWith({ userType: 'client' });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  test('error de backend: muestra mensaje y no cierra', async () => {
    apiFetch.mockRejectedValue(new Error('boom'));
    const onClose = jest.fn();
    const user = userEvent.setup();
    render(<RegisterClientModalContent onClose={onClose} />);

    await fillValid(user);
    const [over18, terms] = screen.getAllByRole('checkbox');
    await user.click(over18);
    await user.click(terms);
    await user.click(submitBtn());

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('ERROR_BACKEND'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
