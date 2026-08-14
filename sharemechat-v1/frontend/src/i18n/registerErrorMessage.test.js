import { registerErrorMessage } from './registerErrorMessage';

/**
 * ADR-059 Fase 4 (frontend): tests del util puro `registerErrorMessage` — mapea
 * errores del backend de registro a mensajes i18n. Prioridad: code conocido
 * (NICKNAME_TAKEN / EMAIL_TAKEN) → clave i18n; si no, `err.data.message` crudo →
 * `err.message` → error de red genérico.
 *
 * i18n mockeado (`t: k => k`) para asertar por CLAVE cuando se traduce.
 */

jest.mock('./index', () => ({ __esModule: true, default: { t: (k) => k } }));

describe('registerErrorMessage', () => {
  test('code NICKNAME_TAKEN -> clave i18n', () => {
    expect(registerErrorMessage({ data: { code: 'NICKNAME_TAKEN' } }))
      .toBe('common.errors.nicknameTaken');
  });

  test('code EMAIL_TAKEN -> clave i18n', () => {
    expect(registerErrorMessage({ data: { code: 'EMAIL_TAKEN' } }))
      .toBe('common.errors.emailTaken');
  });

  test('code desconocido con data.message -> usa el message crudo del backend', () => {
    expect(registerErrorMessage({ data: { code: 'WHATEVER', message: 'algo pasó' } }))
      .toBe('algo pasó');
  });

  test('sin data pero con err.message -> usa err.message', () => {
    expect(registerErrorMessage({ message: 'network fail' })).toBe('network fail');
  });

  test('sin info -> error de red genérico', () => {
    expect(registerErrorMessage(null)).toBe('common.networkError');
    expect(registerErrorMessage({})).toBe('common.networkError');
  });
});
