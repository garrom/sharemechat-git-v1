package com.sharemechat.psp.provider.nowpayments;

import com.sharemechat.security.HmacSha512;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests unitarios de {@link NowPaymentsSignatureVerifier}. El foco:
 * (a) canonicalización recursiva y determinista, (b) verificación
 * end-to-end (firma calculada con canonical → verify OK), (c) rechazo
 * silencioso ante inputs inválidos.
 */
class NowPaymentsSignatureVerifierTest {

    private final NowPaymentsSignatureVerifier verifier = new NowPaymentsSignatureVerifier();

    @Test
    @DisplayName("canonicalize ordena claves alfabéticamente en el nivel raíz")
    void canonicalize_sorts_root_keys() {
        String input = "{\"zeta\":1,\"alpha\":2,\"mu\":3}";
        String canonical = verifier.canonicalize(input.getBytes(StandardCharsets.UTF_8));
        assertNotNull(canonical);
        // Alphabetic: alpha, mu, zeta
        assertEquals("{\"alpha\":2,\"mu\":3,\"zeta\":1}", canonical);
    }

    @Test
    @DisplayName("canonicalize ordena recursivamente en objetos anidados")
    void canonicalize_sorts_nested_keys() {
        String input = "{\"outer\":{\"zeta\":1,\"alpha\":2},\"aaa\":\"first\"}";
        String canonical = verifier.canonicalize(input.getBytes(StandardCharsets.UTF_8));
        assertNotNull(canonical);
        // Raíz: aaa antes que outer; interior: alpha antes que zeta.
        assertEquals("{\"aaa\":\"first\",\"outer\":{\"alpha\":2,\"zeta\":1}}", canonical);
    }

    @Test
    @DisplayName("canonicalize es determinista: mismo input → mismo output")
    void canonicalize_deterministic() {
        String input = "{\"b\":2,\"a\":1,\"c\":{\"y\":1,\"x\":2}}";
        String out1 = verifier.canonicalize(input.getBytes(StandardCharsets.UTF_8));
        String out2 = verifier.canonicalize(input.getBytes(StandardCharsets.UTF_8));
        assertEquals(out1, out2);
    }

    @Test
    @DisplayName("canonicalize devuelve null ante body no-JSON")
    void canonicalize_invalid_json_returns_null() {
        assertNull(verifier.canonicalize("not json at all".getBytes(StandardCharsets.UTF_8)));
        assertNull(verifier.canonicalize("{broken:".getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    @DisplayName("verify OK: firma HMAC-SHA512 sobre canonical body coincide con header")
    void verify_valid_signature() {
        String secret = "test-ipn-secret-123";
        String rawBody = "{\"payment_id\":42,\"order_id\":\"UUID-abc\",\"payment_status\":\"finished\"}";
        // Firma real: canonicalizar → HMAC-SHA512 → hex
        String canonical = verifier.canonicalize(rawBody.getBytes(StandardCharsets.UTF_8));
        String sig = HmacSha512.hexHmacSha512(secret, canonical.getBytes(StandardCharsets.UTF_8));

        assertTrue(verifier.verify(secret, rawBody.getBytes(StandardCharsets.UTF_8), sig));
    }

    @Test
    @DisplayName("verify OK aunque el body venga con claves desordenadas")
    void verify_valid_when_body_keys_out_of_order() {
        String secret = "test-ipn-secret-123";
        // Firma pre-calculada con el body ORDENADO
        String orderedBody = "{\"a\":1,\"b\":2,\"c\":3}";
        String sig = HmacSha512.hexHmacSha512(secret, orderedBody.getBytes(StandardCharsets.UTF_8));

        // Ahora recibimos el body desordenado (como haría el vendor)
        String unorderedBody = "{\"c\":3,\"a\":1,\"b\":2}";
        assertTrue(verifier.verify(secret, unorderedBody.getBytes(StandardCharsets.UTF_8), sig));
    }

    @Test
    @DisplayName("verify rechaza firma modificada")
    void verify_tampered_signature_rejected() {
        String secret = "test-ipn-secret-123";
        String rawBody = "{\"a\":1}";
        String canonical = verifier.canonicalize(rawBody.getBytes(StandardCharsets.UTF_8));
        String sig = HmacSha512.hexHmacSha512(secret, canonical.getBytes(StandardCharsets.UTF_8));
        String tampered = sig.substring(0, sig.length() - 4) + "0000";

        assertFalse(verifier.verify(secret, rawBody.getBytes(StandardCharsets.UTF_8), tampered));
    }

    @Test
    @DisplayName("verify rechaza body modificado (misma firma vieja)")
    void verify_body_tampered_rejected() {
        String secret = "test-ipn-secret-123";
        String originalBody = "{\"amount\":100}";
        String canonical = verifier.canonicalize(originalBody.getBytes(StandardCharsets.UTF_8));
        String sig = HmacSha512.hexHmacSha512(secret, canonical.getBytes(StandardCharsets.UTF_8));

        String tamperedBody = "{\"amount\":9999}";
        assertFalse(verifier.verify(secret, tamperedBody.getBytes(StandardCharsets.UTF_8), sig));
    }

    @Test
    @DisplayName("verify rechaza (sin lanzar) ante inputs inválidos")
    void verify_invalid_inputs_return_false() {
        assertFalse(verifier.verify(null, "{}".getBytes(), "abc"));
        assertFalse(verifier.verify("", "{}".getBytes(), "abc"));
        assertFalse(verifier.verify("secret", null, "abc"));
        assertFalse(verifier.verify("secret", new byte[0], "abc"));
        assertFalse(verifier.verify("secret", "{}".getBytes(), null));
        assertFalse(verifier.verify("secret", "{}".getBytes(), ""));
        assertFalse(verifier.verify("secret", "not-json".getBytes(), "abc"));
    }
}
