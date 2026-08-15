// ADR-059 Fase 4 — utils de superficie/routing (product vs admin).
// resolveHomeUrl decide a dónde va cada rol tras login; navigateToUrl elige
// entre history SPA (paths internos) y window.location (URLs absolutas
// cross-surface). Se usa en todo el flujo de auth: conviene blindarlo.

import Roles from '../constants/Roles';
import UserTypes from '../constants/UserTypes';
import {
  isAbsoluteUrl,
  resolveHomeUrl,
  navigateToUrl,
  isAdminSurface,
  isProductSurface,
  buildPublicAppUrl,
  buildAdminAppUrl,
} from './runtimeSurface';

describe('isAbsoluteUrl', () => {
  test('http/https -> true', () => {
    expect(isAbsoluteUrl('http://x.com')).toBe(true);
    expect(isAbsoluteUrl('https://x.com/a')).toBe(true);
    expect(isAbsoluteUrl('HTTPS://X.com')).toBe(true);
  });
  test('relativo / vacío / nulo -> false', () => {
    expect(isAbsoluteUrl('/client')).toBe(false);
    expect(isAbsoluteUrl('client')).toBe(false);
    expect(isAbsoluteUrl('')).toBe(false);
    expect(isAbsoluteUrl(null)).toBe(false);
    expect(isAbsoluteUrl(undefined)).toBe(false);
  });
});

// El build de test corre en superficie PRODUCT por defecto (sin REACT_APP_SURFACE).
describe('superficie product (por defecto)', () => {
  test('flags', () => {
    expect(isProductSurface()).toBe(true);
    expect(isAdminSurface()).toBe(false);
  });

  test('buildPublicAppUrl es relativo (misma superficie); buildAdminAppUrl es absoluto (cross-surface)', () => {
    expect(buildPublicAppUrl('/client')).toBe('/client');
    const adminUrl = buildAdminAppUrl('/dashboard-admin');
    expect(isAbsoluteUrl(adminUrl)).toBe(true);
    expect(adminUrl.endsWith('/dashboard-admin')).toBe(true);
  });
});

describe('resolveHomeUrl (superficie product)', () => {
  test('CLIENT -> /client (relativo)', () => {
    expect(resolveHomeUrl({ role: Roles.CLIENT })).toBe('/client');
  });
  test('MODEL -> /model', () => {
    expect(resolveHomeUrl({ role: Roles.MODEL })).toBe('/model');
  });
  test('MASTER -> /master', () => {
    expect(resolveHomeUrl({ role: Roles.MASTER })).toBe('/master');
  });
  test('USER + FORM_CLIENT -> /dashboard-user-client', () => {
    expect(resolveHomeUrl({ role: Roles.USER, userType: UserTypes.FORM_CLIENT }))
      .toBe('/dashboard-user-client');
  });
  test('USER + FORM_MODEL -> /dashboard-user-model', () => {
    expect(resolveHomeUrl({ role: Roles.USER, userType: UserTypes.FORM_MODEL }))
      .toBe('/dashboard-user-model');
  });
  test('USER sin userType conocido -> / (fallback)', () => {
    expect(resolveHomeUrl({ role: Roles.USER })).toBe('/');
    expect(resolveHomeUrl({ role: Roles.USER, userType: 'INTERNAL' })).toBe('/');
  });
  test('rol vacío/desconocido -> / (fallback)', () => {
    expect(resolveHomeUrl({})).toBe('/');
    expect(resolveHomeUrl(null)).toBe('/');
  });
  test('ADMIN por rol -> panel admin, absoluto (cross-surface desde product)', () => {
    const url = resolveHomeUrl({ role: Roles.ADMIN });
    expect(isAbsoluteUrl(url)).toBe(true);
    expect(url.endsWith('/dashboard-admin')).toBe(true);
  });
  test('usuario con rol backoffice (SUPPORT) -> panel admin aunque su role no sea ADMIN', () => {
    const url = resolveHomeUrl({ role: Roles.USER, backofficeRoles: ['SUPPORT'] });
    expect(url.endsWith('/dashboard-admin')).toBe(true);
  });
});

describe('navigateToUrl', () => {
  let history;
  let originalLocationDescriptor;

  beforeEach(() => {
    history = { push: jest.fn(), replace: jest.fn() };
    originalLocationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { assign: jest.fn(), replace: jest.fn(), href: '' },
    });
  });

  afterEach(() => {
    if (originalLocationDescriptor) {
      Object.defineProperty(window, 'location', originalLocationDescriptor);
    }
  });

  test('target vacío -> no-op', () => {
    navigateToUrl('', history);
    expect(history.push).not.toHaveBeenCalled();
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  test('URL absoluta -> window.location.assign (no toca history)', () => {
    navigateToUrl('https://admin.x.com/dashboard-admin', history);
    expect(window.location.assign).toHaveBeenCalledWith('https://admin.x.com/dashboard-admin');
    expect(history.push).not.toHaveBeenCalled();
  });

  test('URL absoluta + replace -> window.location.replace', () => {
    navigateToUrl('https://admin.x.com/x', history, { replace: true });
    expect(window.location.replace).toHaveBeenCalledWith('https://admin.x.com/x');
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  test('path interno + history -> history.push (SPA, no recarga)', () => {
    navigateToUrl('/client', history);
    expect(history.push).toHaveBeenCalledWith('/client');
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  test('path interno + replace -> history.replace', () => {
    navigateToUrl('/client', history, { replace: true });
    expect(history.replace).toHaveBeenCalledWith('/client');
  });

  test('path interno SIN history -> window.location.href', () => {
    navigateToUrl('/client', null);
    expect(window.location.href).toBe('/client');
  });
});

describe('superficie admin (REACT_APP_SURFACE=admin)', () => {
  const OLD_ENV = process.env;

  afterEach(() => {
    process.env = OLD_ENV;
    jest.resetModules();
  });

  test('en admin: isAdminSurface true, buildAdminAppUrl relativo, buildPublicAppUrl absoluto', () => {
    jest.resetModules();
    process.env = { ...OLD_ENV, REACT_APP_SURFACE: 'admin' };
    // eslint-disable-next-line global-require
    const mod = require('./runtimeSurface');
    expect(mod.isAdminSurface()).toBe(true);
    expect(mod.isProductSurface()).toBe(false);
    expect(mod.buildAdminAppUrl('/dashboard-admin')).toBe('/dashboard-admin');
    const publicUrl = mod.buildPublicAppUrl('/client');
    expect(mod.isAbsoluteUrl(publicUrl)).toBe(true);
    expect(publicUrl.endsWith('/client')).toBe(true);
  });
});
