import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CheckoutSuccessPage from './CheckoutSuccessPage';
import { getSessionStatus } from '../api/billingApi';

/**
 * ADR-059 Fase 4 (frontend): tests de la landing de retorno del checkout
 * (`CheckoutSuccessPage`, ADR-051). Es la máquina de estados que hace polling al
 * backend tras el pago hosted (el crédito llega por webhook asíncrono):
 * verifying → success / failed / expired / timeout / notFound.
 *
 * Se mockea `getSessionStatus` (red) e i18n (`t: k => k`, con interpolación de
 * minutos para verificar el mapeo pack→minutos). react-router real vía
 * MemoryRouter para leer `?orderId`.
 */

jest.mock('../api/billingApi', () => ({ getSessionStatus: jest.fn() }));
jest.mock('../i18n', () => ({
  __esModule: true,
  default: { t: (k, o) => (o && o.minutes != null ? `${k}:${o.minutes}` : k) },
}));
jest.mock('../components/SessionProvider', () => ({ useSession: () => ({ user: { role: 'CLIENT' } }) }));

function renderAt(search) {
  return render(
    <MemoryRouter initialEntries={[`/checkout/success${search}`]}>
      <CheckoutSuccessPage />
    </MemoryRouter>
  );
}

beforeEach(() => jest.clearAllMocks());

describe('CheckoutSuccessPage', () => {
  test('sin orderId: muestra notFound y no consulta el backend', () => {
    renderAt('');
    expect(screen.getByRole('alert')).toHaveTextContent('checkout.success.notFound');
    expect(getSessionStatus).not.toHaveBeenCalled();
  });

  test('status SUCCESS: confirma y muestra los minutos del pack (P20 -> 22)', async () => {
    getSessionStatus.mockResolvedValue({ status: 'SUCCESS', packId: 'P20' });
    renderAt('?orderId=ord-1');
    const box = await screen.findByRole('status');
    expect(box).toHaveTextContent('checkout.success.confirmed:22');
    expect(getSessionStatus).toHaveBeenCalledWith('ord-1');
  });

  test('status FAILED: muestra el error de pago fallido', async () => {
    getSessionStatus.mockResolvedValue({ status: 'FAILED' });
    renderAt('?orderId=ord-2');
    expect(await screen.findByRole('alert')).toHaveTextContent('checkout.success.failed');
  });

  test('404 del backend: muestra notFound', async () => {
    getSessionStatus.mockRejectedValue({ status: 404 });
    renderAt('?orderId=ord-3');
    expect(await screen.findByRole('alert')).toHaveTextContent('checkout.success.notFound');
  });
});
