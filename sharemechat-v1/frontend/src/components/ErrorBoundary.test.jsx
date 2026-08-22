// Observabilidad #4 — ErrorBoundary: atrapa un error de render, muestra la
// pantalla de recuperación y reporta al backend.

import React from 'react';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';
import { reportClientError } from '../utils/clientErrorReporter';

jest.mock('../utils/clientErrorReporter', () => ({ reportClientError: jest.fn() }));

const Boom = () => {
  throw new Error('componente roto');
};

let errSpy;
beforeEach(() => {
  jest.clearAllMocks();
  // React vuelca el error a console.error; lo silenciamos en el test.
  errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => errSpy.mockRestore());

test('renderiza los hijos cuando no hay error', () => {
  render(<ErrorBoundary><div>contenido ok</div></ErrorBoundary>);
  expect(screen.getByText('contenido ok')).toBeInTheDocument();
});

test('atrapa el error de render, muestra recuperación y reporta', () => {
  render(<ErrorBoundary><Boom /></ErrorBoundary>);
  expect(screen.getByRole('alert')).toHaveTextContent('Algo ha ido mal');
  expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument();
  expect(reportClientError).toHaveBeenCalledTimes(1);
  expect(reportClientError.mock.calls[0][0].message).toBe('componente roto');
});
