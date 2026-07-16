package com.sharemechat.security;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Utilidad genérica de HMAC-SHA512 sobre bytes crudos, con el secret
 * pasado por parámetro (no acoplada a ningún vendor concreto). Pensada
 * para firmar y verificar payloads exactos tal como llegan por la red
 * (p.ej. webhooks).
 *
 * <p>Salida en hexadecimal lowercase. Es el formato que usa NOWPayments
 * en su cabecera {@code x-nowpayments-sig}. Se deja genérica para que
 * otros vendors que exijan SHA-512 (p.ej. algunos PSPs) puedan
 * consumirla sin reescritura.
 *
 * <p>Análoga a {@link HmacSha256} (utilidad estable desde el frente
 * Veriff, hoy usada por Didit y por el `consent` framework). Comparten
 * patrón: método hash + método verify constant-time.
 */
public final class HmacSha512 {

    private HmacSha512() {
    }

    /**
     * Calcula HMAC-SHA512(secret, data) y devuelve el resultado en hex lowercase.
     */
    public static String hexHmacSha512(String secret, byte[] data) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalArgumentException("HMAC secret is required");
        }
        if (data == null) {
            throw new IllegalArgumentException("HMAC data is required");
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA512");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
            byte[] result = mac.doFinal(data);
            return toHexLower(result);
        } catch (Exception e) {
            throw new RuntimeException("HMAC-SHA512 error", e);
        }
    }

    /**
     * Verifica una firma hex entrante contra HMAC-SHA512(secret, data) en
     * tiempo constante. Devuelve false (sin lanzar) si el secret está vacío,
     * los datos son nulos o la firma entrante es nula/vacía: en esos casos
     * la firma no puede considerarse válida.
     */
    public static boolean verifyHexHmacSha512(String secret, byte[] data, String providedHex) {
        if (secret == null || secret.isBlank() || data == null
                || providedHex == null || providedHex.isBlank()) {
            return false;
        }
        final String expected;
        try {
            expected = hexHmacSha512(secret, data);
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
