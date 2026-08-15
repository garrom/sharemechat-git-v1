// ADR-059 Fase 4 — ModalProvider: modal controlado + API promise-based
// (openModal/closeModal) y helpers alert/confirm/selectOptions. Se mockea
// ModalBase para aislar la LÓGICA del provider (estado open, resolución de
// la promesa con el valor de cierre) de la presentación.

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModalProvider, useModal } from './ModalProvider';

// ModalBase mock mínimo: expone title, content, acciones y el onClose.
jest.mock('./ModalBase', () => (props) => {
  if (!props.open) return null;
  return (
    <div data-testid="modal">
      <div data-testid="title">{props.title}</div>
      <div data-testid="content">{props.children}</div>
      {(props.actions || []).map((a, i) => (
        <button key={i} onClick={a.onClick}>{a.label}</button>
      ))}
      <button data-testid="chrome-close" onClick={props.onClose}>chrome-close</button>
    </div>
  );
});

// Consumidor que expone cada método y reporta el valor resuelto.
function Harness({ onResolved, customOnClose }) {
  const modal = useModal();
  return (
    <div>
      <button onClick={async () => onResolved(await modal.openModal({
        title: 'T', content: 'C',
        onClose: customOnClose,
        actions: [{ label: 'Go', onClick: () => modal.closeModal('X') }],
      }))}>open</button>
      <button onClick={async () => onResolved(await modal.alert({ message: 'hola' }))}>alert</button>
      <button onClick={async () => onResolved(await modal.confirm({ message: 'seguro?' }))}>confirm</button>
      <button onClick={async () => onResolved(await modal.selectOptions({
        options: [{ label: 'A', value: 1 }, { label: 'B', value: 2 }],
      }))}>select</button>
    </div>
  );
}

const renderWithProvider = (props = {}) => {
  const onResolved = jest.fn();
  render(<ModalProvider><Harness onResolved={onResolved} {...props} /></ModalProvider>);
  return onResolved;
};

test('useModal fuera de ModalProvider lanza', () => {
  const Bare = () => { useModal(); return null; };
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  expect(() => render(<Bare />)).toThrow(/useModal must be used within/);
  spy.mockRestore();
});

test('sin abrir nada -> no hay modal', () => {
  renderWithProvider();
  expect(screen.queryByTestId('modal')).toBeNull();
});

test('openModal muestra title/content/acciones y resuelve con el valor de closeModal', async () => {
  const onResolved = renderWithProvider();
  fireEvent.click(screen.getByText('open'));
  expect(screen.getByTestId('modal')).toBeInTheDocument();
  expect(screen.getByTestId('title').textContent).toBe('T');
  expect(screen.getByTestId('content').textContent).toBe('C');

  fireEvent.click(screen.getByText('Go')); // closeModal('X')
  await waitFor(() => expect(onResolved).toHaveBeenCalledWith('X'));
  expect(screen.queryByTestId('modal')).toBeNull(); // cerrado
});

test('alert: botón OK resuelve true y cierra', async () => {
  const onResolved = renderWithProvider();
  fireEvent.click(screen.getByText('alert'));
  expect(screen.getByTestId('modal')).toBeInTheDocument();
  fireEvent.click(screen.getByText('OK'));
  await waitFor(() => expect(onResolved).toHaveBeenCalledWith(true));
});

test('confirm: Aceptar -> true, Cancelar -> false', async () => {
  let onResolved = renderWithProvider();
  fireEvent.click(screen.getByText('confirm'));
  fireEvent.click(screen.getByText('Aceptar'));
  await waitFor(() => expect(onResolved).toHaveBeenCalledWith(true));

  onResolved = renderWithProvider();
  fireEvent.click(screen.getAllByText('confirm')[1]);
  fireEvent.click(screen.getByText('Cancelar'));
  await waitFor(() => expect(onResolved).toHaveBeenCalledWith(false));
});

test('selectOptions: clicar una opción resuelve su value', async () => {
  const onResolved = renderWithProvider();
  fireEvent.click(screen.getByText('select'));
  fireEvent.click(screen.getByText('A'));
  await waitFor(() => expect(onResolved).toHaveBeenCalledWith(1));
});

test('onClose personalizado del modal se delega (no cierra por defecto)', () => {
  const customOnClose = jest.fn();
  renderWithProvider({ customOnClose });
  fireEvent.click(screen.getByText('open'));
  fireEvent.click(screen.getByTestId('chrome-close'));
  expect(customOnClose).toHaveBeenCalledTimes(1);
  // Con onClose personalizado el modal NO se cierra solo.
  expect(screen.getByTestId('modal')).toBeInTheDocument();
});
