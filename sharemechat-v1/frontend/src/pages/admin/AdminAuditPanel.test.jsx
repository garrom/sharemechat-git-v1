// Depuración "control interno" (2026-08-22): el panel de auditoría pasa de 5 a 3
// pestañas — se elimina "Incidencias" (era un stub) y "BFPM" se funde dentro de
// "Accounting" (es un check contable del bonus, no un módulo de bonus).

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AdminAuditPanel from './AdminAuditPanel';

jest.mock('../../i18n', () => ({ __esModule: true, default: { t: (k) => k } }));
jest.mock('./audit/AuditAccountingPanel', () => () => <div data-testid="accounting" />);
jest.mock('./audit/AuditSessionIntegrityPanel', () => () => <div data-testid="session-integrity" />);
jest.mock('./audit/AuditRuntimeHealthPanel', () => () => <div data-testid="runtime-health" />);

describe('AdminAuditPanel (control interno)', () => {
  test('muestra 3 pestañas reales; ni Incidencias ni BFPM', () => {
    render(<AdminAuditPanel />);
    expect(screen.getByText('admin.audit.tabs.accounting')).toBeInTheDocument();
    expect(screen.getByText('admin.audit.tabs.sessionIntegrity')).toBeInTheDocument();
    expect(screen.getByText('admin.audit.tabs.runtimeHealth')).toBeInTheDocument();
    expect(screen.queryByText('admin.audit.tabs.incidents')).toBeNull();
    expect(screen.queryByText('admin.audit.tabs.bfpm')).toBeNull();
  });

  test('por defecto abre Accounting (que ahora incluye el resumen BFPM)', () => {
    render(<AdminAuditPanel />);
    expect(screen.getByTestId('accounting')).toBeInTheDocument();
    expect(screen.queryByTestId('runtime-health')).toBeNull();
  });

  test('cambia a Salud del runtime al pulsar su pestaña', () => {
    render(<AdminAuditPanel />);
    fireEvent.click(screen.getByText('admin.audit.tabs.runtimeHealth'));
    expect(screen.getByTestId('runtime-health')).toBeInTheDocument();
    expect(screen.queryByTestId('accounting')).toBeNull();
  });
});
