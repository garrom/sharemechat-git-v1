export const getBackofficeRoles = (user) => {
  if (!Array.isArray(user?.backofficeRoles)) return [];
  return user.backofficeRoles
    .map((value) => String(value || '').trim().toUpperCase())
    .filter(Boolean);
};

export const getBackofficePermissions = (user) => {
  if (!Array.isArray(user?.backofficePermissions)) return [];
  return user.backofficePermissions
    .map((value) => String(value || '').trim().toUpperCase())
    .filter(Boolean);
};

export const hasBackofficeRole = (user, roleCode) => {
  const target = String(roleCode || '').trim().toUpperCase();
  if (!target) return false;

  if (target === 'ADMIN' && String(user?.role || '').trim().toUpperCase() === 'ADMIN') {
    return true;
  }

  return getBackofficeRoles(user).includes(target);
};

export const hasBackofficePermission = (user, permissionCode) => {
  const target = String(permissionCode || '').trim().toUpperCase();
  if (!target) return false;
  return getBackofficePermissions(user).includes(target);
};

export const isBackofficeAdmin = (user) => hasBackofficeRole(user, 'ADMIN');

export const isBackofficeSupport = (user) => hasBackofficeRole(user, 'SUPPORT');

export const canAccessBackoffice = (user) =>
  isBackofficeAdmin(user) || isBackofficeSupport(user);
