package com.sharemechat.psp.provider.nowpayments;

import com.sharemechat.security.HmacSha512;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * ADR-051 Fase 2 + Fase 4h: verificación de firma HMAC-SHA512 del
 * webhook IPN de NOWPayments.
 *
 * <p>Contrato del vendor (aprendido en test end-to-end sandbox
 * 2026-07-17):
 * <ol>
 *   <li>Header entrante: {@code x-nowpayments-sig} con la firma en hex
 *       lowercase.</li>
 *   <li>El body llega ya en la forma canónica que NOWPayments firma en
 *       su servidor (JSON con claves ordenadas alfabéticamente + sin
 *       espacios entre separadores). Nuestra tarea es solo verificar
 *       HMAC-SHA512 directamente sobre los bytes recibidos, sin
 *       ninguna transformación intermedia.</li>
 *   <li>Comparación constant-time con el header {@code x-nowpayments-sig}.</li>
 * </ol>
 *
 * <p><b>Aprendizaje Fase 4h</b>: la version original re-canonicalizaba
 * el body con Jackson (parse -> re-serializar con
 * {@code ORDER_MAP_ENTRIES_BY_KEYS}). Aunque los tests unitarios eran
 * verdes, en produccion Jackson cambiaba imperceptiblemente el body
 * (p.ej. re-formateaba {@code 0.0001695} y otros decimales pequeños) y
 * el HMAC divergia. La verificacion directa sobre {@code rawBody} es
 * mas simple y correcta.
 *
 * <p>Analogo al patron de Didit ({@code KycSessionService.processDiditWebhook})
 * y de Stripe/Segpay: firmar sobre bytes crudos.
 */
@Component
public class NowPaymentsSignatureVerifier {

    private static final Logger log = LoggerFactory.getLogger(NowPaymentsSignatureVerifier.class);

    /**
     * Verifica firma. Devuelve {@code false} (sin lanzar) ante cualquier
     * error: secret vacío, body vacío, header vacío, HMAC divergente.
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

        return HmacSha512.verifyHexHmacSha512(ipnSecret, rawBody, providedSignatureHex);
    }
}
