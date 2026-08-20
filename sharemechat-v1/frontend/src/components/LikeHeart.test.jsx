import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import LikeHeart from './LikeHeart';
import { apiFetch } from '../config/http';

/**
 * Card 1 Fase B: corazon-LIKE autocontenido (cliente -> modelo). Pide su estado
 * al montar (GET /models/{id}/likes) y hace toggle (POST). Tests con apiFetch
 * mockeado; i18n devuelve la clave (no probamos textos traducidos).
 */
jest.mock('../config/http', () => ({ apiFetch: jest.fn() }));
jest.mock('../i18n', () => ({ t: (k) => k }));

describe('LikeHeart', () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  test('sin modelUserId no renderiza ni llama a la API', () => {
    const { container } = render(<LikeHeart />);
    expect(container.firstChild).toBeNull();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  test('al montar pide el estado y pinta count + corazon lleno si hasLiked', async () => {
    apiFetch.mockResolvedValueOnce({ count: 12, hasLiked: true });
    render(<LikeHeart modelUserId={7} />);
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/models/7/likes'));
    const btn = await screen.findByRole('button');
    await waitFor(() => expect(btn).toHaveTextContent('12'));
    expect(btn).toHaveTextContent('❤'); // corazon lleno = liked
  });

  test('estado no-liked pinta corazon vacio', async () => {
    apiFetch.mockResolvedValueOnce({ count: 0, hasLiked: false });
    render(<LikeHeart modelUserId={3} />);
    const btn = await screen.findByRole('button');
    await waitFor(() => expect(btn).toHaveTextContent('🤍'));
  });

  test('toggle: click hace POST al endpoint toggle y actualiza el estado', async () => {
    apiFetch
      .mockResolvedValueOnce({ count: 3, hasLiked: false })  // GET al montar
      .mockResolvedValueOnce({ count: 4, hasLiked: true });  // POST toggle
    render(<LikeHeart modelUserId={9} />);
    const btn = await screen.findByRole('button');
    await waitFor(() => expect(btn).toHaveTextContent('3'));

    await act(async () => { fireEvent.click(btn); });

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/models/9/likes/toggle', { method: 'POST' }));
    await waitFor(() => expect(btn).toHaveTextContent('4'));
    expect(btn).toHaveTextContent('❤');
  });

  test('stopPropagation=true impide que el click burbujee al contenedor', async () => {
    apiFetch.mockResolvedValue({ count: 0, hasLiked: false });
    const parentClick = jest.fn();
    render(
      <div onClick={parentClick}>
        <LikeHeart modelUserId={5} stopPropagation />
      </div>
    );
    const btn = await screen.findByRole('button');
    await act(async () => { fireEvent.click(btn); });
    expect(parentClick).not.toHaveBeenCalled();
  });

  test('si la API falla al montar, no rompe (no pinta count roto)', async () => {
    apiFetch.mockRejectedValueOnce(new Error('boom'));
    render(<LikeHeart modelUserId={1} />);
    const btn = await screen.findByRole('button');
    // state=null -> count 0, corazon vacio; el componente sigue vivo
    expect(btn).toHaveTextContent('0');
    expect(btn).toHaveTextContent('🤍');
  });
});
