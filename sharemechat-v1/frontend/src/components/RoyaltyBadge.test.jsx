import React from 'react';
import { render, screen } from '@testing-library/react';
import RoyaltyBadge from './RoyaltyBadge';

/**
 * Card 1 Fase 3: insignias de realeza. RoyaltyBadge mapea el `code` que viene
 * del backend (ModelLikeStateDTO.badgeCode) al SVG correspondiente. Tests del
 * contrato de render: code valido -> svg; code desconocido/nulo -> nada;
 * title -> aria-label + <title>.
 */
describe('RoyaltyBadge', () => {
  const CODES = ['TIARA', 'DIADEM', 'CROWN', 'GEMS_CROWN', 'IMPERIAL'];

  test('un code valido renderiza un svg role="img" con aria-label = code', () => {
    render(<RoyaltyBadge code="CROWN" />);
    const svg = screen.getByRole('img');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-label', 'CROWN');
  });

  test('todos los codes canonicos renderizan un svg', () => {
    CODES.forEach((code) => {
      const { container } = render(<RoyaltyBadge code={code} />);
      expect(container.querySelector('svg')).not.toBeNull();
    });
  });

  test('code desconocido no renderiza nada', () => {
    const { container } = render(<RoyaltyBadge code="NOPE" />);
    expect(container.querySelector('svg')).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  test('code nulo/indefinido no renderiza nada', () => {
    const { container: c1 } = render(<RoyaltyBadge code={null} />);
    expect(c1.firstChild).toBeNull();
    const { container: c2 } = render(<RoyaltyBadge />);
    expect(c2.firstChild).toBeNull();
  });

  test('title: aria-label usa title y hay un <title> dentro del svg', () => {
    render(<RoyaltyBadge code="IMPERIAL" title="Imperial" />);
    const svg = screen.getByRole('img');
    expect(svg).toHaveAttribute('aria-label', 'Imperial');
    expect(svg.querySelector('title')).toHaveTextContent('Imperial');
  });

  test('sin title no se pinta el elemento <title>', () => {
    render(<RoyaltyBadge code="TIARA" />);
    expect(screen.getByRole('img').querySelector('title')).toBeNull();
  });

  test('size controla el width del svg', () => {
    render(<RoyaltyBadge code="DIADEM" size={48} />);
    expect(screen.getByRole('img')).toHaveAttribute('width', '48');
  });
});
