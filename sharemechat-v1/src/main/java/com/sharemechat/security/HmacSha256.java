package com.sharemechat.security;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Utilidad genérica de HMAC-SHA256 sobre bytes crudos, con el secret pasado por
 * parámetro (no acoplada a ninguna property concreta). Pensada para firmar y
 * verificar payloads exactos tal como llegan por la red (p.ej. webhooks).
 *
 * Salida en hexadecimal lowercase, que es el formato que usa Veriff en su
 * cabecera X-HMAC-SIGNATURE.
 *
 * NOTA: se deja como utilidad genérica (no específica de Veriff) para que otros
 * consumidores de HMAC-SHA256 (p.ej. el firmado de consent) puedan adoptarla en
 * el futuro sin reescritura; en este paso solo la consume el cliente Veriff.
 */
public final class HmacSha256 {

    private HmacSha256() {
    }

    /**
     * Calcula HMAC-SHA256(secret, data) y devuelve el resultado en hex lowercase.
     */
    public static String hexHmacSha256(String secret, byte[] data) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalArgumentException("HMAC secret is required");
        }
        if (data == null) {
            throw new IllegalArgumentException("HMAC data is required");
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] result = mac.doFinal(data);
            return toHexLower(result);
        } catch (Exception e) {
            throw new RuntimeException("HMAC-SHA256 error", e);
        }
    }

    /**
     * Verifica una firma hex entrante contra HMAC-SHA256(secret, data) en
     * tiempo constante. Devuelve false (sin lanzar) si el secret está vacío, los
     * datos son nulos o la firma entrante es nula/vacía: en esos casos la firma
     * no puede considerarse válida.
     */
    public static boolean verifyHexHmacSha256(String secret, byte[] data, String providedHex) {
        if (secret == null || secret.isBlank() || data == null
                || providedHex == null || providedHex.isBlank()) {
            return false;
        }
        final String expected;
        try {
            expected = hexHmacSha256(secret, data);
        } catch (RuntimeException e) {
            return false;
        }
        byte[] expectedBytes = expected.getBytes(StandardCharsets.UTF_8);
        byte[] providedBytes = providedHex.trim().toLowerCase().getBytes(StandardCharsets.UTF_8);
        // MessageDigest.isEqual es constant-time y seguro ante longitudes distintas.
        return MessageDigest.isEqual(expectedBytes, providedBytes);
    }

    private static String toHexLower(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(Character.forDigit((b >> 4) & 0xF, 16));
            sb.append(Character.forDigit(b & 0xF, 16));
        }
        return sb.toString();
    }
}
