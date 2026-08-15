// ADR-059 Fase 4 — utils puros de acceso a backoffice (permisos/roles).
// Deciden qué usuario puede entrar al panel admin; conviene blindarlos.

import {
  getBackofficeRoles,
  getBackofficePermissions,
  hasBackofficeRole,
  hasBackofficePermission,
  isBackofficeAdmin,
  isBackofficeSupport,
  isBackofficeAudit,
  canAccessBackoffice,
} from './backofficeAccess';

describe('getBackofficeRoles / getBackofficePermissions', () => {
  test('normaliza (trim + upper) y filtra vacíos', () => {
    const user = { backofficeRoles: ['  support ', 'Audit', '', null, 'ADMIN'] };
    expect(getBackofficeRoles(user)).toEqual(['SUPPORT', 'AUDIT', 'ADMIN']);
  });

  test('no-array (undefined, null, string, objeto) -> []', () => {
    expect(getBackofficeRoles(undefined)).toEqual([]);
    expect(getBackofficeRoles(null)).toEqual([]);
    expect(getBackofficeRoles({ backofficeRoles: 'SUPPORT' })).toEqual([]);
    expect(getBackofficePermissions({})).toEqual([]);
  });

  test('permissions se normalizan igual', () => {
    const user = { backofficePermissions: [' perm_x ', 'PERM_Y', ''] };
    expect(getBackofficePermissions(user)).toEqual(['PERM_X', 'PERM_Y']);
  });
});

describe('hasBackofficeRole', () => {
  test('ADMIN por role del user (aunque no tenga backofficeRoles)', () => {
    expect(hasBackofficeRole({ role: 'ADMIN' }, 'ADMIN')).toBe(true);
    expect(hasBackofficeRole({ role: ' admin ' }, 'admin')).toBe(true); // ambos se normalizan
  });

  test('rol por pertenencia a backofficeRoles', () => {
    const user = { role: 'USER', backofficeRoles: ['SUPPORT'] };
    expect(hasBackofficeRole(user, 'support')).toBe(true);
    expect(hasBackofficeRole(user, 'AUDIT')).toBe(false);
  });

  test('role=ADMIN NO concede otros roles (SUPPORT) salvo que estén en backofficeRoles', () => {
    expect(hasBackofficeRole({ role: 'ADMIN' }, 'SUPPORT')).toBe(false);
  });

  test('roleCode vacío/nulo -> false', () => {
    expect(hasBackofficeRole({ role: 'ADMIN', backofficeRoles: ['SUPPORT'] }, '')).toBe(false);
    expect(hasBackofficeRole({ role: 'ADMIN' }, null)).toBe(false);
  });
});

describe('hasBackofficePermission', () => {
  test('pertenencia normalizada', () => {
    const user = { backofficePermissions: ['PERM_SUPPORT_CHAT_HANDLE'] };
    expect(hasBackofficePermission(user, 'perm_support_chat_handle')).toBe(true);
    expect(hasBackofficePermission(user, 'PERM_OTHER')).toBe(false);
  });

  test('permissionCode vacío -> false', () => {
    expect(hasBackofficePermission({ backofficePermissions: ['X'] }, '')).toBe(false);
  });
});

describe('isBackoffice* helpers', () => {
  test('admin/support/audit delegan en hasBackofficeRole', () => {
    expect(isBackofficeAdmin({ role: 'ADMIN' })).toBe(true);
    expect(isBackofficeSupport({ backofficeRoles: ['SUPPORT'] })).toBe(true);
    expect(isBackofficeAudit({ backofficeRoles: ['AUDIT'] })).toBe(true);
    expect(isBackofficeAdmin({ role: 'USER' })).toBe(false);
  });
});

describe('canAccessBackoffice', () => {
  test('true si admin O support O audit', () => {
    expect(canAccessBackoffice({ role: 'ADMIN' })).toBe(true);
    expect(canAccessBackoffice({ backofficeRoles: ['SUPPORT'] })).toBe(true);
    expect(canAccessBackoffice({ backofficeRoles: ['AUDIT'] })).toBe(true);
  });

  test('false para usuario normal (sin roles backoffice)', () => {
    expect(canAccessBackoffice({ role: 'CLIENT' })).toBe(false);
    expect(canAccessBackoffice({ role: 'USER', backofficeRoles: [] })).toBe(false);
    expect(canAccessBackoffice(null)).toBe(false);
  });
});
