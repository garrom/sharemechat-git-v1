import React from 'react';
import { render, screen, act } from '@testing-library/react';
import SessionHUD from './SessionHUD';

/**
 * ADR-059 Fase 4 (frontend): tests del HUD de sesión (`SessionHUD`, ADR-052 §S2).
 * Es la superficie donde cayó el bug del timer/coste del 2026-08-11 que motivó
 * ADR-059: el HUD calcula LOCALMENTE (el backend no factura por minuto) el saldo
 * estimado del cliente (base − elapsed·rate/60) y lo ganado por la modelo
 * (elapsed·rate·pct/6000 + gifts).
 *
 * Usa `setInterval` + `Date.now()`, así que se controlan con FAKE TIMERS de Jest
 * (modern: mockean también Date) para verificar los importes de forma determinista.
 * i18n mockeado (`t: k => k`); los importes se pintan directos (no vía t).
 */

jest.mock('../i18n', () => ({ __esModule: true, default: { t: (k) => k } }));

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('SessionHUD', () => {
  test('inactivo no pinta nada', () => {
    const { container } = render(
      <SessionHUD variant="client" active={false} ratePerMin={2} baseBalance={10} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('cliente en t=0: cronómetro 00:00 y saldo = baseBalance', () => {
    render(<SessionHUD variant="client" active ratePerMin={2} baseBalance={10} />);
    const hud = screen.getByTestId('session-hud-client');
    expect(hud).toHaveTextContent('00:00');
    expect(hud).toHaveTextContent('10.00 €'); // consumido 0 -> saldo = base
  });

  test('cliente a los 60s: descuenta el coste del minuto (10 - 2 = 8.00)', () => {
    render(<SessionHUD variant="client" active ratePerMin={2} baseBalance={10} />);
    act(() => { jest.advanceTimersByTime(60000); });
    const hud = screen.getByTestId('session-hud-client');
    expect(hud).toHaveTextContent('01:00');
    expect(hud).toHaveTextContent('8.00 €'); // 10 - (60*2/60) = 8
  });

  test('modelo a los 60s: gana por tiempo según el % del tramo (rate 2, 50% -> +1.00)', () => {
    render(<SessionHUD variant="model" active ratePerMin={2} modelSharePct={50} giftsSum={0} />);
    act(() => { jest.advanceTimersByTime(60000); });
    const hud = screen.getByTestId('session-hud-model');
    expect(hud).toHaveTextContent('01:00');
    expect(hud).toHaveTextContent('+1.00 €'); // (60*2*50)/6000 = 1.00
  });

  test('modelo con gifts: suma los regalos a lo ganado por tiempo (+1.00 + 5 = +6.00)', () => {
    render(<SessionHUD variant="model" active ratePerMin={2} modelSharePct={50} giftsSum={5} />);
    act(() => { jest.advanceTimersByTime(60000); });
    const hud = screen.getByTestId('session-hud-model');
    expect(hud).toHaveTextContent('+6.00 €');
  });
});
