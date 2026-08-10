package com.sharemechat.util;

/**
 * Normaliza un nickname para eliminar friccion en el registro: en vez de
 * rechazar espacios o caracteres no permitidos, los corrige automaticamente.
 * <ul>
 *   <li>espacios (incl. NBSP) -&gt; guion</li>
 *   <li>elimina cualquier caracter fuera de [letra unicode, digito, . _ -]</li>
 *   <li>colapsa guiones repetidos y limpia los extremos</li>
 *   <li>recorta a 30</li>
 * </ul>
 * Mantiene mayusculas y acentos (permite \p{L}). Reglas ESPEJO del frontend
 * (frontend/src/utils/normalizeNickname.js) y del patron historico del DTO.
 * Idempotente: normalize(normalize(x)).equals(normalize(x)).
 *
 * Nota de seguridad: al eliminar todo lo que no sea [\p{L}\p{N}._-] esta
 * funcion ofrece la MISMA garantia anti-inyeccion que el antiguo @Pattern
 * (H2 hardening: nada de HTML/JS/control chars llega a persistirse ni a los
 * emails), pero saneando en vez de rechazar.
 */
public final class NicknameNormalizer {

    private NicknameNormalizer() {}

    public static String normalize(String raw) {
        if (raw == null) return "";
        String s = raw.trim();
        s = s.replaceAll("[\\s\\u00A0]+", "-");
        s = s.replaceAll("[^\\p{L}\\p{N}._-]", "");
        s = s.replaceAll("-{2,}", "-").replaceAll("^-+|-+$", "");
        if (s.length() > 30) {
            s = s.substring(0, 30).replaceAll("-+$", "");
        }
        return s;
    }
}
