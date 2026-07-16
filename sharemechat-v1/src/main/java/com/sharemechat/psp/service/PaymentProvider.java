package com.sharemechat.psp.service;

import com.sharemechat.psp.dto.CreateInvoiceRequest;
import com.sharemechat.psp.dto.CreateInvoiceResult;
import com.sharemechat.psp.dto.PaymentStatus;
import com.sharemechat.psp.dto.WebhookEvent;

import java.util.Map;

/**
 * ADR-051 D1: contrato vendor-agnostic para procesadores de pago.
 *
 * <p>Todo lo que vive por encima de esta interface (orquestadores,
 * controllers, integración con {@code TransactionService.creditPackWithBonus})
 * es vendor-agnostic. NOWPayments es implementación concreta, no
 * ciudadano privilegiado. Cuando llegue Vendo/CommerceGate/RocketGate:
 * nueva clase {@code XyzPaymentProvider implements PaymentProvider} +
 * INSERT en {@code psp_provider_config}. Cero cambios upstream.
 *
 * <p>Cada implementación concreta debe estar registrada como bean Spring
 * y devolver un {@link #getProviderKey()} único (case-insensitive: se
 * normaliza a lowercase en el registry).
 */
public interface PaymentProvider {

    /**
     * Identificador único del proveedor (lowercase). Debe coincidir con
     * la fila en {@code psp_provider_config.provider_key} y con la
     * columna {@code payment_sessions.provider}.
     * Ejemplos: {@code "nowpayments"}, {@code "vendo"}, {@code "commercegate"}.
     */
    String getProviderKey();

    /**
     * Crea un invoice/checkout hosted en el vendor y devuelve la URL de
     * redirect + el ID interno del vendor.
     *
     * @throws com.sharemechat.psp.PspException si el vendor rechaza la
     *         petición, credenciales inválidas, timeout, etc.
     */
    CreateInvoiceResult createInvoice(CreateInvoiceRequest request);

    /**
     * Consulta el estado actual de un pago en el vendor. Usado por el
     * job de reconciliación (deuda #D-41 del ADR-051) y por endpoints
     * admin de auditoría.
     */
    PaymentStatus getPaymentStatus(String providerPaymentId);

    /**
     * Verifica la firma HMAC del webhook. Constant-time comparison
     * obligatorio (usar {@code HmacSha256.verifyHexHmacSha256} o
     * equivalente vendor-específico).
     *
     * @param rawBody body raw del webhook (BYTES, sin normalizar).
     * @param headers headers HTTP del request (nombres case-insensitive
     *                según convención Spring).
     * @return {@code true} si la firma es válida, {@code false} en cualquier
     *         otro caso (sin lanzar excepción para poder persistir el evento
     *         con {@code is_signature_valid=false} para auditoría).
     */
    boolean verifyWebhookSignature(byte[] rawBody, Map<String, String> headers);

    /**
     * Parsea el body del webhook (asumiendo firma ya validada) y normaliza
     * a {@link WebhookEvent}. Debe derivar {@code providerEventId} sintético
     * ({@code SHA-256(rawBody)}) si el vendor no envía uno explícito.
     */
    WebhookEvent parseWebhook(byte[] rawBody);
}
