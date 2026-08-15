// ADR-059 Fase 4 — gate de KYC de cliente en los puntos de pago.
// Defensa en profundidad (el backend también rechaza con 403); este helper
// evita el roundtrip y redirige a /client-kyc. Incluye defensa open-redirect.

import {
  ensureClientKycApproved,
  isInternalReturnPath,
  CLIENT_KYC_RETURN_URL_KEY,
  CLIENT_KYC_DEFAULT_RETURN_PATH,
} from './clientKycGate';

describe('isInternalReturnPath', () => {
  test('acepta solo paths internos que empiezan por "/" (no "//")', () => {
    expect(isInternalReturnPath('/client')).toBe(true);
    expect(isInternalReturnPath('/model?tab=x')).toBe(true);
    expect(isInternalReturnPath('//evil.com')).toBe(false); // protocol-relative
    expect(isInternalReturnPath('http://evil.com')).toBe(false);
    expect(isInternalReturnPath('client')).toBe(false);
    expect(isInternalReturnPath('')).toBe(false);
    expect(isInternalReturnPath(null)).toBe(false);
    expect(isInternalReturnPath(123)).toBe(false);
  });
});

describe('ensureClientKycApproved', () => {
  let history;

  beforeEach(() => {
    history = { push: jest.fn() };
    window.sessionStorage.clear();
    jest.restoreAllMocks();
  });

  test('APPROVED -> true, sin redirección ni escritura en sessionStorage', () => {
    const setItem = jest.spyOn(window.sessionStorage.__proto__, 'setItem');
    const result = ensureClientKycApproved({ clientKycStatus: 'APPROVED' }, history, '/client');
    expect(result).toBe(true);
    expect(history.push).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  test('NO aprobado -> false, guarda returnPath y redirige a /client-kyc?return=<encoded>', () => {
    const result = ensureClientKycApproved({ clientKycStatus: 'PENDING' }, history, '/model?tab=x');
    expect(result).toBe(false);
    expect(window.sessionStorage.getItem(CLIENT_KYC_RETURN_URL_KEY)).toBe('/model?tab=x');
    expect(history.push).toHaveBeenCalledWith(
      '/client-kyc?return=' + encodeURIComponent('/model?tab=x')
    );
  });

  test('user null/sin status -> tratado como no aprobado', () => {
    expect(ensureClientKycApproved(null, history, '/client')).toBe(false);
    expect(history.push).toHaveBeenCalled();
  });

  test('defensa open-redirect: returnPath externo o inválido -> fallback a /client', () => {
    for (const bad of ['//evil.com', 'http://evil.com', 'sin-barra', '']) {
      history.push.mockClear();
      window.sessionStorage.clear();
      ensureClientKycApproved({ clientKycStatus: 'PENDING' }, history, bad);
      expect(window.sessionStorage.getItem(CLIENT_KYC_RETURN_URL_KEY)).toBe(CLIENT_KYC_DEFAULT_RETURN_PATH);
      expect(history.push).toHaveBeenCalledWith(
        '/client-kyc?return=' + encodeURIComponent(CLIENT_KYC_DEFAULT_RETURN_PATH)
      );
    }
  });

  test('si sessionStorage.setItem lanza, igualmente redirige (try/catch)', () => {
    jest.spyOn(window.sessionStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    const result = ensureClientKycApproved({ clientKycStatus: 'PENDING' }, history, '/client');
    expect(result).toBe(false);
    expect(history.push).toHaveBeenCalledWith('/client-kyc?return=%2Fclient');
  });
});
