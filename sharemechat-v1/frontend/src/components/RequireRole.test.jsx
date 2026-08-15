// ADR-059 Fase 4 — RequireRole: guarda de acceso del frontend. Combina el
// gate operacional PRELAUNCH (ADR-009) con control por rol / userType /
// backoffice. Es seguridad: conviene cubrir sus ramas.
//
// useSession y PreLaunchScreen se mockean; los utils de acceso/routing
// (backofficeAccess, runtimeSurface) se dejan REALES (ya testeados, puros).

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import RequireRole from './RequireRole';
import { useSession } from './SessionProvider';

jest.mock('./SessionProvider', () => ({ useSession: jest.fn() }));
jest.mock('./PreLaunchScreen', () => () => <div data-testid="prelaunch">PRELAUNCH</div>);

const LocationProbe = () => {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname}</div>;
};

function renderGuard(props, { path = '/x' } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <RequireRole {...props}>
        <div>SECRET</div>
      </RequireRole>
      <LocationProbe />
    </MemoryRouter>
  );
}

const setUser = (user, loading = false) => useSession.mockReturnValue({ user, loading });

beforeEach(() => useSession.mockReset());

test('loading -> no renderiza children ni redirige (null)', () => {
  setUser(null, true);
  renderGuard({ role: 'CLIENT' });
  expect(screen.queryByText('SECRET')).toBeNull();
  expect(screen.getByTestId('loc').textContent).toBe('/x');
});

test('sin user -> redirige a /login', () => {
  setUser(null, false);
  renderGuard({ role: 'CLIENT' });
  expect(screen.getByTestId('loc').textContent).toBe('/login');
  expect(screen.queryByText('SECRET')).toBeNull();
});

test('productAccessMode vacío/desconocido -> no abre la puerta (null)', () => {
  setUser({ role: 'CLIENT' }); // sin productAccessMode
  renderGuard({ role: 'CLIENT' });
  expect(screen.queryByText('SECRET')).toBeNull();
  expect(screen.queryByTestId('prelaunch')).toBeNull();
});

test('PRELAUNCH + no allowlisted -> PreLaunchScreen', () => {
  setUser({ role: 'CLIENT', productAccessMode: 'PRELAUNCH' });
  renderGuard({ role: 'CLIENT' });
  expect(screen.getByTestId('prelaunch')).toBeInTheDocument();
  expect(screen.queryByText('SECRET')).toBeNull();
});

test('PRELAUNCH + allowlisted=true -> pasa el gate y muestra children si el rol casa', () => {
  setUser({ role: 'CLIENT', productAccessMode: 'PRELAUNCH', allowlisted: true });
  renderGuard({ role: 'CLIENT' });
  expect(screen.getByText('SECRET')).toBeInTheDocument();
});

test('rol correcto + OPEN -> children', () => {
  setUser({ role: 'CLIENT', productAccessMode: 'OPEN' });
  renderGuard({ role: 'CLIENT' });
  expect(screen.getByText('SECRET')).toBeInTheDocument();
});

test('rol incorrecto -> redirige al dashboard propio (resolveHomeUrl)', () => {
  setUser({ role: 'CLIENT', productAccessMode: 'OPEN' });
  renderGuard({ role: 'MODEL' }); // pide MODEL, user es CLIENT
  expect(screen.getByTestId('loc').textContent).toBe('/client');
  expect(screen.queryByText('SECRET')).toBeNull();
});

test('roles[] incluye el rol -> children; no lo incluye -> redirige', () => {
  setUser({ role: 'CLIENT', productAccessMode: 'OPEN' });
  const { unmount } = renderGuard({ roles: ['CLIENT', 'MODEL'] });
  expect(screen.getByText('SECRET')).toBeInTheDocument();
  unmount();

  setUser({ role: 'MASTER', productAccessMode: 'OPEN' });
  renderGuard({ roles: ['CLIENT', 'MODEL'] });
  expect(screen.getByTestId('loc').textContent).toBe('/master');
});

test('allowedUserTypes no incluye el userType -> /unauthorized', () => {
  setUser({ role: 'USER', userType: 'FORM_MODEL', productAccessMode: 'OPEN' });
  renderGuard({ role: 'USER', allowedUserTypes: ['FORM_CLIENT'] });
  expect(screen.getByTestId('loc').textContent).toBe('/unauthorized');
});

test('backofficeRoles: autorizado -> children (bypassa el gate de modo)', () => {
  setUser({ role: 'USER', backofficeRoles: ['SUPPORT'] }); // sin productAccessMode
  renderGuard({ backofficeRoles: ['SUPPORT'] });
  expect(screen.getByText('SECRET')).toBeInTheDocument();
});

test('backofficeRoles: NO autorizado -> redirige al dashboard propio', () => {
  setUser({ role: 'CLIENT', productAccessMode: 'OPEN' });
  renderGuard({ backofficeRoles: ['SUPPORT'] });
  expect(screen.getByTestId('loc').textContent).toBe('/client');
  expect(screen.queryByText('SECRET')).toBeNull();
});
