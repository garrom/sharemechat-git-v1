import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAppModals } from './useAppModals';

/**
 * ADR-059 Fase 4 (frontend): tests del hook foundational `useAppModals` (usado en
 * medio frontend). Re-expone alert/confirm de ModalProvider y añade modales de
 * alto nivel que devuelven PROMESAS (compra, guards…). Se prueba la LÓGICA:
 * - guards que deciden sin abrir modal;
 * - wrappers que delegan en confirm/alert;
 * - openPurchaseModal: usa DEFAULT_PACKS y resuelve {confirmed, pack} al
 *   seleccionar / {confirmed:false} al cancelar.
 *
 * Se mockea `ModalProvider` (capturamos `openModal`), i18n, y los componentes
 * hijos pesados. Patrón harness-captura-API + MemoryRouter (el hook usa router).
 */

const mockModal = {
  alert: jest.fn(),
  confirm: jest.fn(),
  openModal: jest.fn(),
  closeModal: jest.fn(),
};

jest.mock('./ModalProvider', () => ({ useModal: () => mockModal }));
jest.mock('../i18n', () => ({ __esModule: true, default: { t: (k) => k } }));
jest.mock('./LoginModalContent', () => () => null);
jest.mock('./PublicSignupTeaserModal', () => () => null);
jest.mock('../consent/consentClient', () => ({ TERMS_VERSION: 'v1', isLocalAgeOk: () => true }));

let api;
function Host() {
  api = useAppModals();
  return null;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockModal.openModal.mockReturnValue(Promise.resolve()); // el hook hace openModal(...).then(...)
  render(
    <MemoryRouter>
      <Host />
    </MemoryRouter>
  );
});

describe('useAppModals', () => {
  test('openActiveSessionGuard: sin sesión activa devuelve true y no abre modal', async () => {
    let result;
    await act(async () => {
      result = await api.openActiveSessionGuard({ hasStreaming: false, hasCalling: false });
    });
    expect(result).toBe(true);
    expect(mockModal.alert).not.toHaveBeenCalled();
  });

  test('openActiveSessionGuard: con sesión activa avisa (alert) y devuelve false', async () => {
    mockModal.alert.mockResolvedValue(undefined);
    let result;
    await act(async () => {
      result = await api.openActiveSessionGuard({ hasStreaming: true, hasCalling: false });
    });
    expect(mockModal.alert).toHaveBeenCalledTimes(1);
    expect(result).toBe(false);
  });

  test('openRemoveFavoriteConfirm: delega en confirm (danger) y devuelve su resultado', async () => {
    mockModal.confirm.mockResolvedValue(true);
    let result;
    await act(async () => {
      result = await api.openRemoveFavoriteConfirm('Ana');
    });
    expect(result).toBe(true);
    expect(mockModal.confirm).toHaveBeenCalledWith(expect.objectContaining({ danger: true }));
  });

  test('openPurchaseModal: usa los packs por defecto y resuelve {confirmed, pack} al seleccionar', async () => {
    let promise;
    act(() => { promise = api.openPurchaseModal(); });

    const config = mockModal.openModal.mock.calls[0][0];
    render(config.content); // renderiza el contenido capturado (los PackCards)
    const cards = screen.getAllByRole('button');
    expect(cards).toHaveLength(4); // DEFAULT_PACKS

    fireEvent.click(cards[0]); // selecciona el primer pack (P10)
    const result = await promise;
    expect(result.confirmed).toBe(true);
    expect(result.pack.id).toBe('P10');
    expect(mockModal.closeModal).toHaveBeenCalled();
  });

  test('openPurchaseModal: la acción de cancelar resuelve {confirmed:false}', async () => {
    let promise;
    act(() => { promise = api.openPurchaseModal(); });

    const config = mockModal.openModal.mock.calls[0][0];
    act(() => { config.actions[0].onClick(); }); // "cancelar"
    const result = await promise;
    expect(result).toEqual({ confirmed: false });
  });
});
