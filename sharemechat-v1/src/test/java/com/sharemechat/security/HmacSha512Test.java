package com.sharemechat.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests unitarios de {@link HmacSha512}. Vector de referencia estándar
 * del algoritmo (test de humo) + verificaciones de fallos silenciosos
 * conforme al contrato (blanks/null NO deben lanzar).
 */
class HmacSha512Test {

    // Test vector conocido y públicamente reproducible.
    // key = "key", data = "The quick brown fox jumps over the lazy dog"
    // HMAC-SHA512 hex esperado (verificado con `openssl dgst -sha512 -hmac`).
    private static final String KEY = "key";
    private static final String DATA_STR = "The quick brown fox jumps over the lazy dog";
    private static final String EXPECTED_HEX =
            "b42af09057bac1e2d41708e48a902e09b5ff7f12ab428a4fe86653c73dd248fb"
          + "82f948a549f7b791a5b41915ee4d1ec3935357e4e2317250d0372afa2ebeeb3a";

    @Test
    @DisplayName("hexHmacSha512 devuelve el vector estándar conocido")
    void hex_matches_reference_vector() {
        byte[] data = DATA_STR.getBytes(StandardCharsets.UTF_8);
        assertEquals(EXPECTED_HEX, HmacSha512.hexHmacSha512(KEY, data));
    }

    @Test
    @DisplayName("verifyHexHmacSha512 acepta firma correcta")
    void verify_valid_signature() {
        byte[] data = DATA_STR.getBytes(StandardCharsets.UTF_8);
        assertTrue(HmacSha512.verifyHexHmacSha512(KEY, data, EXPECTED_HEX));
    }

    @Test
    @DisplayName("verifyHexHmacSha512 acepta uppercase (trim + toLowerCase)")
    void verify_case_insensitive() {
        byte[] data = DATA_STR.getBytes(StandardCharsets.UTF_8);
        assertTrue(HmacSha512.verifyHexHmacSha512(KEY, data, EXPECTED_HEX.toUpperCase()));
    }

    @Test
    @DisplayName("verifyHexHmacSha512 rechaza firma inválida sin lanzar")
    void verify_invalid_signature_returns_false() {
        byte[] data = DATA_STR.getBytes(StandardCharsets.UTF_8);
        String bad = "0".repeat(EXPECTED_HEX.length());
        assertFalse(HmacSha512.verifyHexHmacSha512(KEY, data, bad));
    }

    @Test
    @DisplayName("verifyHexHmacSha512 rechaza cuando cambia un byte del data (sensibilidad)")
    void verify_data_tampered_returns_false() {
        byte[] tampered = "The quick brown fox jumps over the lazy DOG".getBytes(StandardCharsets.UTF_8);
        assertFalse(HmacSha512.verifyHexHmacSha512(KEY, tampered, EXPECTED_HEX));
    }

    @Test
    @DisplayName("verifyHexHmacSha512 devuelve false (no lanza) ante secret blank/null")
    void verify_blank_secret_returns_false() {
        byte[] data = DATA_STR.getBytes(StandardCharsets.UTF_8);
        assertFalse(HmacSha512.verifyHexHmacSha512(null, data, EXPECTED_HEX));
        assertFalse(HmacSha512.verifyHexHmacSha512("", data, EXPECTED_HEX));
        assertFalse(HmacSha512.verifyHexHmacSha512("   ", data, EXPECTED_HEX));
    }

    @Test
    @DisplayName("verifyHexHmacSha512 devuelve false ante data null o firma blank")
    void verify_null_data_or_blank_sig_returns_false() {
        byte[] data = DATA_STR.getBytes(StandardCharsets.UTF_8);
        assertFalse(HmacSha512.verifyHexHmacSha512(KEY, null, EXPECTED_HEX));
        assertFalse(HmacSha512.verifyHexHmacSha512(KEY, data, null));
        assertFalse(HmacSha512.verifyHexHmacSha512(KEY, data, ""));
    }

    @Test
    @DisplayName("hexHmacSha512 lanza IllegalArgumentException con secret blank (contrato)")
    void hex_blank_secret_throws() {
        assertThrows(IllegalArgumentException.class,
                () -> HmacSha512.hexHmacSha512(null, "x".getBytes()));
        assertThrows(IllegalArgumentException.class,
                () -> HmacSha512.hexHmacSha512("", "x".getBytes()));
    }

    @Test
    @DisplayName("hexHmacSha512 lanza IllegalArgumentException con data null (contrato)")
    void hex_null_data_throws() {
        assertThrows(IllegalArgumentException.class,
                () -> HmacSha512.hexHmacSha512("k", null));
    }
}
