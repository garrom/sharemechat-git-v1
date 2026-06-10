package com.sharemechat.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class HmacSha256Test {

    // Vector conocido y publicado de HMAC-SHA256:
    //   key  = "key"
    //   data = "The quick brown fox jumps over the lazy dog"
    //   hmac = f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8
    private static final String SECRET = "key";
    private static final byte[] DATA =
            "The quick brown fox jumps over the lazy dog".getBytes(StandardCharsets.UTF_8);
    private static final String EXPECTED_HEX =
            "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8";

    @Test
    @DisplayName("Firma de salida: HMAC-SHA256 hex lowercase coincide con el vector conocido")
    void hexHmacSha256_matchesKnownVector() {
        String sig = HmacSha256.hexHmacSha256(SECRET, DATA);
        assertEquals(EXPECTED_HEX, sig);
        assertEquals(sig, sig.toLowerCase()); // hex lowercase
    }

    @Test
    @DisplayName("Webhook: firma válida -> true")
    void verify_validSignature() {
        assertTrue(HmacSha256.verifyHexHmacSha256(SECRET, DATA, EXPECTED_HEX));
    }

    @Test
    @DisplayName("Webhook: firma válida en mayúsculas también valida (se normaliza a lowercase)")
    void verify_validSignatureUppercase() {
        assertTrue(HmacSha256.verifyHexHmacSha256(SECRET, DATA, EXPECTED_HEX.toUpperCase()));
    }

    @Test
    @DisplayName("Webhook: firma inválida -> false")
    void verify_invalidSignature() {
        assertFalse(HmacSha256.verifyHexHmacSha256(SECRET, DATA,
                "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef0"));
    }

    @Test
    @DisplayName("Webhook: firma ausente (null o vacía) -> false")
    void verify_absentSignature() {
        assertFalse(HmacSha256.verifyHexHmacSha256(SECRET, DATA, null));
        assertFalse(HmacSha256.verifyHexHmacSha256(SECRET, DATA, ""));
        assertFalse(HmacSha256.verifyHexHmacSha256(SECRET, DATA, "   "));
    }

    @Test
    @DisplayName("Webhook: body alterado con la misma firma -> false")
    void verify_alteredBody() {
        byte[] altered = "The quick brown fox jumps over the lazy dog!".getBytes(StandardCharsets.UTF_8);
        assertFalse(HmacSha256.verifyHexHmacSha256(SECRET, altered, EXPECTED_HEX));
    }

    @Test
    @DisplayName("Webhook: secret vacío -> false (no se puede validar)")
    void verify_blankSecret() {
        assertFalse(HmacSha256.verifyHexHmacSha256("", DATA, EXPECTED_HEX));
        assertFalse(HmacSha256.verifyHexHmacSha256(null, DATA, EXPECTED_HEX));
    }
}
