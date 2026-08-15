import { normalizeNickname } from './normalizeNickname';

/**
 * ADR-059 Fase 4 (frontend): tests del util puro `normalizeNickname` — corrige
 * el nickname en registro (espejo del backend `NicknameNormalizer`) en vez de
 * rechazarlo: espacios→guion, elimina chars fuera de [letra, dígito, . _ -],
 * colapsa guiones, limpia extremos, recorta a 30. Mantiene mayúsculas y acentos.
 * Idempotente. Unit directo, sin dependencias.
 */

describe('normalizeNickname', () => {
  test('espacios (incl. múltiples) -> guion', () => {
    expect(normalizeNickname('Ana Maria')).toBe('Ana-Maria');
    expect(normalizeNickname('a   b')).toBe('a-b'); // colapsa
  });

  test('mantiene letras (con acentos), dígitos y . _ -', () => {
    expect(normalizeNickname('josé_2.0-x')).toBe('josé_2.0-x');
  });

  test('elimina caracteres no permitidos', () => {
    expect(normalizeNickname('a@b#c!')).toBe('abc');
  });

  test('colapsa guiones repetidos y limpia los extremos', () => {
    expect(normalizeNickname('--a--b--')).toBe('a-b');
    expect(normalizeNickname('  hola  ')).toBe('hola'); // trim
  });

  test('recorta a 30 caracteres', () => {
    const out = normalizeNickname('a'.repeat(40));
    expect(out).toHaveLength(30);
  });

  test('vacío / null / no-string -> cadena vacía', () => {
    expect(normalizeNickname('')).toBe('');
    expect(normalizeNickname(null)).toBe('');
    expect(normalizeNickname(undefined)).toBe('');
  });

  test('es idempotente: normalize(normalize(x)) === normalize(x)', () => {
    const raw = '  Foo @Bar__baz  ';
    const once = normalizeNickname(raw);
    expect(normalizeNickname(once)).toBe(once);
  });
});
