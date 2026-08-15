// ADR-059 Fase 4 — helpers puros de errores de API.

import { isEmailNotVerifiedError, getApiErrorMessage, EMAIL_NOT_VERIFIED_CODE } from './apiErrors';

describe('isEmailNotVerifiedError', () => {
  test('detecta el code en err.code o err.data.code (case-insensitive)', () => {
    expect(isEmailNotVerifiedError({ code: EMAIL_NOT_VERIFIED_CODE })).toBe(true);
    expect(isEmailNotVerifiedError({ code: 'email_not_verified' })).toBe(true);
    expect(isEmailNotVerifiedError({ data: { code: 'EMAIL_NOT_VERIFIED' } })).toBe(true);
  });

  test('otros codes / sin code -> false', () => {
    expect(isEmailNotVerifiedError({ code: 'OTHER' })).toBe(false);
    expect(isEmailNotVerifiedError({})).toBe(false);
    expect(isEmailNotVerifiedError(null)).toBe(false);
  });
});

describe('getApiErrorMessage', () => {
  test('prioridad data.message > message > fallback', () => {
    expect(getApiErrorMessage({ data: { message: 'del backend' }, message: 'js' })).toBe('del backend');
    expect(getApiErrorMessage({ message: 'js error' })).toBe('js error');
  });

  test('fallback por defecto y personalizado', () => {
    expect(getApiErrorMessage(null)).toBe('Ha ocurrido un error.');
    expect(getApiErrorMessage({}, 'algo falló')).toBe('algo falló');
  });
});
