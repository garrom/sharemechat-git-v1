// Normaliza un nickname para eliminar friccion en el registro: en vez de
// rechazar espacios o caracteres no permitidos, los corrige automaticamente.
//   - espacios (incl. NBSP) -> guion
//   - elimina cualquier caracter fuera de [letra unicode, digito, . _ -]
//   - colapsa guiones repetidos y limpia los extremos
//   - recorta a 30
// Mantiene mayusculas y acentos (el patron permite \p{L}). Reglas ESPEJO del
// backend (com.sharemechat.util.NicknameNormalizer) y del patron del DTO.
// Idempotente: normalize(normalize(x)) === normalize(x).
export function normalizeNickname(raw) {
  if (!raw) return '';
  let s = String(raw).trim();
  s = s.replace(/\s+/gu, '-');
  s = s.replace(/[^\p{L}\p{N}._-]/gu, '');
  s = s.replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
  if (s.length > 30) s = s.slice(0, 30).replace(/-+$/g, '');
  return s;
}

export default normalizeNickname;
