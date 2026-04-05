import Roles from '../constants/Roles';
import UserTypes from '../constants/UserTypes';
import { canAccessBackoffice } from './backofficeAccess';

const SURFACE = String(process.env.REACT_APP_SURFACE || 'product').trim().toLowerCase();

export const ADMIN_APP_ORIGIN = 'https://admin.test.sharemechat.com';
export const PRODUCT_APP_ORIGIN = 'https://test.sharemechat.com';

const normalizePath = (path) => {
  if (!path || path === '') return '/';
  return path.startsWith('/') ? path : `/${path}`;
};

const buildAppUrl = (targetOrigin, path = '/') => {
  const normalizedPath = normalizePath(path);
  if (!targetOrigin) {
    return normalizedPath;
  }
  return `${targetOrigin}${normalizedPath}`;
};

export const isAdminSurface = () => SURFACE === 'admin';

export const isProductSurface = () => !isAdminSurface();

export const buildAdminAppUrl = (path = '/') =>
  isAdminSurface() ? normalizePath(path) : buildAppUrl(ADMIN_APP_ORIGIN, path);

export const buildPublicAppUrl = (path = '/') =>
  isProductSurface() ? normalizePath(path) : buildAppUrl(PRODUCT_APP_ORIGIN, path);

export const isAbsoluteUrl = (value) => /^https?:\/\//i.test(String(value || ''));

export const resolveHomeUrl = (user) => {
  if (canAccessBackoffice(user) || String(user?.role || '').trim().toUpperCase() === Roles.ADMIN) {
    return buildAdminAppUrl('/dashboard-admin');
  }

  if (user?.role === Roles.CLIENT) {
    return buildPublicAppUrl('/client');
  }

  if (user?.role === Roles.MODEL) {
    return buildPublicAppUrl('/model');
  }

  if (user?.role === Roles.USER) {
    if (user?.userType === UserTypes.FORM_CLIENT) {
      return buildPublicAppUrl('/dashboard-user-client');
    }
    if (user?.userType === UserTypes.FORM_MODEL) {
      return buildPublicAppUrl('/dashboard-user-model');
    }
  }

  return buildPublicAppUrl('/');
};

export const navigateToUrl = (target, history, { replace = false } = {}) => {
  if (!target) return;

  if (isAbsoluteUrl(target)) {
    if (typeof window !== 'undefined') {
      if (replace) {
        window.location.replace(target);
      } else {
        window.location.assign(target);
      }
    }
    return;
  }

  if (history && typeof history.push === 'function') {
    if (replace && typeof history.replace === 'function') {
      history.replace(target);
      return;
    }
    history.push(target);
    return;
  }

  if (typeof window !== 'undefined') {
    window.location.href = target;
  }
};
