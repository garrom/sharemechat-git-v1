package com.sharemechat.psp.provider.nowpayments;

import com.sharemechat.security.HmacSha512;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests unitarios de {@link NowPaymentsSignatureVerifier}. Tras el fix
 * Fase 4h el verifier firma directamente sobre {@code rawBody} sin
 * re-canonicalizar (NOWPayments envía el body ya en forma canónica y
 * cualquier re-serialización rompe la firma por artifacts de formato
 * en decimales pequeños).
 */
class NowPaymentsSignatureVerifierTest {

    private final NowPaymentsSignatureVerifier verifier = new NowPaymentsSignatureVerifier();

    @Test
    @DisplayName("verify OK: firma HMAC-SHA512 sobre rawBody coincide con header")
    void verify_valid_signature_on_raw_body() {
        String secret = "test-ipn-secret-123";
        String rawBody = "{\"invoice_id\":42,\"order_id\":\"UUID-abc\",\"payment_status\":\"finished\"}";
        String sig = HmacSha512.hexHmacSha512(secret, rawBody.getBytes(StandardCharsets.UTF_8));

        assertTrue(verifier.verify(secret, rawBody.getBytes(StandardCharsets.UTF_8), sig));
    }

    @Test
    @DisplayName("verify OK con body real de NOWPayments (ordenado alfabéticamente + sin espacios)")
    void verify_valid_signature_on_real_shape_body() {
        String secret = "test-ipn-secret-XyZ";
        // Forma real observada en test end-to-end 2026-07-17:
        // claves ordenadas alfabéticamente, sin espacios, decimales
        // en notación decimal (no científica).
        String rawBody = "{\"actually_paid\":0,\"invoice_id\":6029004715,\"order_id\":\"3404bf2e\","
                + "\"outcome_amount\":0.0001695,\"pay_amount\":11.38029826,\"payment_status\":\"finished\"}";
        String sig = HmacSha512.hexHmacSha512(secret, rawBody.getBytes(StandardCharsets.UTF_8));

        assertTrue(verifier.verify(secret, rawBody.getBytes(StandardCharsets.UTF_8), sig));
    }

    @Test
    @DisplayName("verify rechaza firma modificada")
    void verify_tampered_signature_rejected() {
        String secret = "test-ipn-secret-123";
        String rawBody = "{\"a\":1}";
        String sig = HmacSha512.hexHmacSha512(secret, rawBody.getBytes(StandardCharsets.UTF_8));
        String tampered = sig.substring(0, sig.length() - 4) + "0000";

        assertFalse(verifier.verify(secret, rawBody.getBytes(StandardCharsets.UTF_8), tampered));
    }

    @Test
    @DisplayName("verify rechaza body modificado (misma firma vieja)")
    void verify_body_tampered_rejected() {
        String secret = "test-ipn-secret-123";
        String originalBody = "{\"amount\":100}";
        String sig = HmacSha512.hexHmacSha512(secret, originalBody.getBytes(StandardCharsets.UTF_8));

        String tamperedBody = "{\"amount\":9999}";
        assertFalse(verifier.verify(secret, tamperedBody.getBytes(StandardCharsets.UTF_8), sig));
    }

    @Test
    @DisplayName("verify rechaza body con orden distinto (byte-exact matters)")
    void verify_reordered_body_rejected() {
        String secret = "test-ipn-secret-123";
        // La firma se calcula sobre este orden concreto.
        String bodyA = "{\"a\":1,\"b\":2}";
        String sig = HmacSha512.hexHmacSha512(secret, bodyA.getBytes(StandardCharsets.UTF_8));

        // Mismo contenido pero orden distinto -> bytes distintos -> HMAC distinto.
        // Confirma que la verificacion es byte-exact sobre rawBody.
        String bodyB = "{\"b\":2,\"a\":1}";
        assertFalse(verifier.verify(secret, bodyB.getBytes(StandardCharsets.UTF_8), sig));
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
    }
}
