// ADR-059 Fase 4 — TrialCooldownModal: modal cuando el USER agota sus trials.
// El texto del tiempo restante lo produce formatRemaining(ms) (lógica interna,
// se verifica vía el texto renderizado). Se cubren sus ramas + callbacks.

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TrialCooldownModal from './TrialCooldownModal';

jest.mock('../i18n', () => ({ __esModule: true, default: { t: (k) => k } }));

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function renderModal(props = {}) {
  return render(
    <TrialCooldownModal open remainingMs={null} onClose={jest.fn()} onPurchase={jest.fn()} {...props} />
  );
}

test('open=false -> no renderiza nada', () => {
  const { container } = render(<TrialCooldownModal open={false} remainingMs={MIN} />);
  expect(container).toBeEmptyDOMElement();
});

describe('formatRemaining (vía texto renderizado)', () => {
  const cases = [
    [null, 'unos minutos'],
    [15 * MIN, '15 min'],
    [30 * 1000, '1 min'], // <1 min -> mínimo 1 min
    [HOUR + 20 * MIN, '1 h 20 min'],
    [2 * HOUR, '2 horas'], // horas exactas, sin minutos
    [1 * HOUR, '1 hora'],
    [3 * DAY, '3 días'],
    [1 * DAY, '1 día'], // día exacto sin horas
    [DAY + 5 * HOUR, '1 día y 5 horas'],
    [2 * DAY + 1 * HOUR, '2 días y 1 hora'],
  ];

  test.each(cases)('remainingMs=%p -> "%s"', (ms, expected) => {
    const { unmount } = renderModal({ remainingMs: ms });
    expect(screen.getByText(expected)).toBeInTheDocument();
    unmount();
  });
});

describe('callbacks', () => {
  test('botón "más tarde" -> onClose', () => {
    const onClose = jest.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'common.actions.later' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('botón premium -> onPurchase', () => {
    const onPurchase = jest.fn();
    renderModal({ onPurchase });
    fireEvent.click(screen.getByRole('button', { name: 'dashboardUserClient.actions.goPremium' }));
    expect(onPurchase).toHaveBeenCalledTimes(1);
  });

  test('botón cerrar (×) -> onClose', () => {
    const onClose = jest.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'common.close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
