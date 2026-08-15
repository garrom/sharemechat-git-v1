// ADR-059 Fase 4 — MaintenanceProvider: red de seguridad SPA para ventanas de
// mantenimiento del backend (Paquete 10.A.3.pre). Overlay bloqueante dirigido
// por CustomEvent 'sharemechat:maintenance' + auto-recuperación por poll a
// /api/users/me. Se testea el ciclo mostrar/ocultar y la recuperación.

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { MaintenanceProvider, useMaintenance, notifyMaintenance } from './MaintenanceProvider';

const EVENT = 'sharemechat:maintenance';
const emit = (active) =>
  act(() => {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { active } }));
  });

const Probe = () => {
  const { active } = useMaintenance();
  return <div data-testid="active">{String(active)}</div>;
};

describe('MaintenanceProvider (event-driven)', () => {
  test('renderiza children y sin overlay al inicio', () => {
    render(<MaintenanceProvider><div>APP</div></MaintenanceProvider>);
    expect(screen.getByText('APP')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  test('evento active:true muestra overlay; active:false lo oculta', () => {
    render(<MaintenanceProvider><div>APP</div></MaintenanceProvider>);
    emit(true);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('SHAREMECHAT')).toBeInTheDocument();
    emit(false);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  test('notifyMaintenance() dispara el mismo canal', () => {
    render(<MaintenanceProvider><div>APP</div></MaintenanceProvider>);
    act(() => notifyMaintenance(true));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    act(() => notifyMaintenance(false));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  test('useMaintenance expone el flag active', () => {
    render(<MaintenanceProvider><Probe /></MaintenanceProvider>);
    expect(screen.getByTestId('active').textContent).toBe('false');
    emit(true);
    expect(screen.getByTestId('active').textContent).toBe('true');
  });
});

describe('MaintenanceProvider (auto-recuperación por poll)', () => {
  let fetchSpy;
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => {
    jest.useRealTimers();
    if (fetchSpy) fetchSpy.mockRestore();
  });

  test('con overlay activo, el poll a backend vivo (200) lo cierra solo', async () => {
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({ status: 200 });
    render(<MaintenanceProvider><div>APP</div></MaintenanceProvider>);
    emit(true);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    // Avanza el intervalo de poll (30s); pingBackend ve 200 -> vivo -> emite active:false.
    await act(async () => {
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchSpy).toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  test('backend aún caído (503) mantiene el overlay', async () => {
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({ status: 503 });
    render(<MaintenanceProvider><div>APP</div></MaintenanceProvider>);
    emit(true);

    await act(async () => {
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
});
