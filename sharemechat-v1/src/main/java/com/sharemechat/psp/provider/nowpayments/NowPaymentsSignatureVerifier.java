package com.sharemechat.psp.provider.nowpayments;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.sharemechat.security.HmacSha512;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * ADR-051 Fase 2: verificación de firma HMAC-SHA512 del webhook IPN de
 * NOWPayments.
 *
 * <p>Contrato del vendor:
 * <ol>
 *   <li>Header entrante: {@code x-nowpayments-sig} con la firma en hex
 *       lowercase.</li>
 *   <li>El body del webhook se parsea a un mapa y se re-serializa con
 *       las claves ordenadas alfabéticamente <b>de forma recursiva</b>
 *       (objetos anidados también). Este es el "canonical JSON" que
 *       NOWPayments firma en su lado.</li>
 *   <li>HMAC-SHA512 sobre el canonical JSON usando el IPN secret como
 *       clave.</li>
 *   <li>Comparación constant-time con el header {@code x-nowpayments-sig}.</li>
 * </ol>
 *
 * <p>Jackson hace el sort recursivo automáticamente con la feature
 * {@link SerializationFeature#ORDER_MAP_ENTRIES_BY_KEYS}. Los tests
 * unitarios validan que el ordenado sea determinista y que reordena
 * objetos anidados (no solo el raíz).
 *
 * <p>Análoga a {@link com.sharemechat.security.HmacSha256#verifyHexHmacSha256}
 * pero con paso extra de canonicalización del body (Didit firma sobre
 * body raw, NOWPayments firma sobre canonical). Este verifier encapsula
 * la diferencia dentro del adapter del vendor.
 */
@Component
public class NowPaymentsSignatureVerifier {

    private static final Logger log = LoggerFactory.getLogger(NowPaymentsSignatureVerifier.class);

    /** ObjectMapper de instancia con feature ORDER_MAP_ENTRIES_BY_KEYS activada. */
    private static final ObjectMapper CANONICAL_MAPPER = new ObjectMapper()
            .configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true);

    /**
     * Verifica firma. Devuelve {@code false} (sin lanzar) ante cualquier
     * error: secret vacío, body vacío, header vacío, body no parseable
     * como JSON, HMAC divergente.
     *
     * @param ipnSecret secret configurado en el panel NOWPayments.
     * @param rawBody bytes crudos del body del webhook (tal como llegan).
     * @param providedSignatureHex valor del header {@code x-nowpayments-sig}.
     */
    public boolean verify(String ipnSecret, byte[] rawBody, String providedSignatureHex) {
        if (ipnSecret == null || ipnSecret.isBlank()) {
            log.warn("[PSP-NOWPAYMENTS-SIG] ipnSecret blank");
            return false;
        }
        if (rawBody == null || rawBody.length == 0) return false;
        if (providedSignatureHex == null || providedSignatureHex.isBlank()) return false;

        String canonical = canonicalize(rawBody);
        if (canonical == null) return false;
        byte[] canonicalBytes = canonical.getBytes(StandardCharsets.UTF_8);

        return HmacSha512.verifyHexHmacSha512(ipnSecret, canonicalBytes, providedSignatureHex);
    }

    /**
     * Serializa el body con claves ordenadas alfabéticamente de forma
     * recursiva. Devuelve {@code null} si el body no es un JSON parseable.
     *
     * <p>Package-private para tests unitarios (validan orden determinista
     * y ordenación recursiva).
     */
    String canonicalize(byte[] rawBody) {
        try {
            // Parseamos a Map (no a JsonNode) para forzar que Jackson
            // aplique ORDER_MAP_ENTRIES_BY_KEYS al re-serializar. Con
            // JsonNode el sort no aplica igual porque los ObjectNode
            // preservan orden de inserción.
            Map<String, Object> tree = CANONICAL_MAPPER.readValue(rawBody, Map.class);
            return CANONICAL_MAPPER.writeValueAsString(tree);
        } catch (Exception ex) {
            log.warn("[PSP-NOWPAYMENTS-SIG] canonicalize fail: {}", ex.getMessage());
            return null;
        }
    }
}
