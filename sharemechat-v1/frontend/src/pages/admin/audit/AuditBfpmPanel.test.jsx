// BFPM Fase 4B-b — AuditBfpmPanel: resumen backoffice del bonus financiado (ADR-012).
// Read-only: consume GET /api/admin/audit/bfpm-summary al montar. Se testea el render
// de la invariante (OK vs DESCUADRE), el conteo de pares, las anomalías y el error de carga.

import React from 'react';
import { render, screen } from '@testing-library/react';
import AuditBfpmPanel from './AuditBfpmPanel';

const okResponse = (data) => ({
  ok: true,
  json: async () => data,
  text: async () => '',
});

const errResponse = (msg) => ({
  ok: false,
  json: async () => ({}),
  text: async () => msg,
});

const BASE = {
  sumBonusGrant: 6.0,
  sumBonusFunding: -6.0,
  invariantDelta: 0.0,
  invariantOk: true,
  bonusPairCount: 3,
  grantsWithoutFunding: [],
  fundingsWithoutGrant: [],
  totalPagosMismatch: [],
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AuditBfpmPanel', () => {
  test('invariante cuadrada: muestra OK, importes y "sin anomalías", y llama al endpoint read-only', async () => {
    global.fetch = jest.fn().mockResolvedValue(okResponse(BASE));

    render(<AuditBfpmPanel />);

    expect(await screen.findByText('OK')).toBeInTheDocument();
    expect(screen.getByText('6.00 €')).toBeInTheDocument();
    expect(screen.getByText('-6.00 €')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Sin anomalías BFPM')).toBeInTheDocument();

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/audit/bfpm-summary?limit=50',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  test('invariante rota + huérfano: muestra DESCUADRE y la fila del BONUS_GRANT sin funding', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      okResponse({
        ...BASE,
        invariantDelta: 0.5,
        invariantOk: false,
        bonusPairCount: 4,
        grantsWithoutFunding: [
          { transactionId: 101, userId: 42, amount: 0.5, description: 'BFPM bonus_grant pack=P20 order=abc' },
        ],
        totalPagosMismatch: [
          { userId: 42, totalPagos: 20.0, sumIngreso: 18.0, delta: 2.0 },
        ],
      }),
    );

    render(<AuditBfpmPanel />);

    expect(await screen.findByText('DESCUADRE')).toBeInTheDocument();
    expect(screen.getByText('BONUS_GRANT sin BONUS_FUNDING (1)')).toBeInTheDocument();
    expect(screen.getByText('101')).toBeInTheDocument();
    expect(screen.getByText(/Descuadre total_pagos/)).toBeInTheDocument();
  });

  test('error de carga: muestra el mensaje del backend', async () => {
    global.fetch = jest.fn().mockResolvedValue(errResponse('acceso denegado'));

    render(<AuditBfpmPanel />);

    expect(await screen.findByText('acceso denegado')).toBeInTheDocument();
  });
});
