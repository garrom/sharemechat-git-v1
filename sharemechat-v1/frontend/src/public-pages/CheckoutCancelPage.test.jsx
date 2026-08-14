import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CheckoutCancelPage from './CheckoutCancelPage';

/**
 * ADR-059 Fase 4 (frontend): landing de checkout cancelado (`CheckoutCancelPage`,
 * ADR-051). Componente simple: mensaje de aborto + CTA para reintentar. i18n y
 * useSession mockeados; react-router real vía MemoryRouter.
 */

jest.mock('../i18n', () => ({ __esModule: true, default: { t: (k) => k } }));
jest.mock('../components/SessionProvider', () => ({ useSession: () => ({ user: { role: 'CLIENT' } }) }));

test('CheckoutCancelPage muestra el mensaje de cancelación y el botón para reintentar', () => {
  render(
    <MemoryRouter>
      <CheckoutCancelPage />
    </MemoryRouter>
  );
  expect(screen.getByRole('heading')).toHaveTextContent('checkout.cancel.title');
  expect(screen.getByText('checkout.cancel.message')).toBeInTheDocument();
  expect(screen.getByRole('button')).toHaveTextContent('checkout.cancel.retry');
});
