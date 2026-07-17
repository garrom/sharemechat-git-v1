package com.sharemechat.psp.provider.nowpayments;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sharemechat.psp.PspException;
import com.sharemechat.psp.dto.CreateInvoiceRequest;
import com.sharemechat.psp.dto.CreateInvoiceResult;
import com.sharemechat.psp.dto.PaymentStatus;
import com.sharemechat.psp.dto.WebhookEvent;
import com.sharemechat.psp.service.PaymentProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.security.MessageDigest;
import java.util.Locale;
import java.util.Map;

/**
 * ADR-051 D1: implementación concreta de {@link PaymentProvider} para
 * NOWPayments. Compone {@link NowPaymentsHttpClient} (HTTP) +
 * {@link NowPaymentsSignatureVerifier} (HMAC-SHA512) y traduce los
 * shapes vendor-specific a los DTOs vendor-agnostic del subsistema PSP.
 *
 * <p>{@link #getProviderKey()} devuelve {@code "nowpayments"} — debe
 * coincidir con la fila en {@code psp_provider_config.provider_key} y
 * con la columna {@code payment_sessions.provider}.
 *
 * <p>Mapping de payment_status vendor → enum interno
 * ({@link PaymentStatus}):
 * <ul>
 *   <li>{@code waiting / confirming / confirmed / sending} → {@link PaymentStatus#PENDING}</li>
 *   <li>{@code finished} → {@link PaymentStatus#SUCCESS}</li>
 *   <li>{@code partially_paid / failed} → {@link PaymentStatus#FAILED}</li>
 *   <li>{@code refunded} → {@link PaymentStatus#REFUNDED}</li>
 *   <li>{@code expired} → {@link PaymentStatus#EXPIRED}</li>
 *   <li>otros (null, valor desconocido) → {@link PaymentStatus#PENDING}
 *       defensivo (evita cerrar sessions por status inesperado).</li>
 * </ul>
 *
 * <p>Header de firma: {@code x-nowpayments-sig} (case-insensitive según
 * convención HTTP). Los tests unitarios validan captura correcta.
 */
@Component
public class NowPaymentsPaymentProvider implements PaymentProvider {

    private static final Logger log = LoggerFactory.getLogger(NowPaymentsPaymentProvider.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static final String PROVIDER_KEY = "nowpayments";
    public static final String SIGNATURE_HEADER = "x-nowpayments-sig";

    private final NowPaymentsHttpClient httpClient;
    private final NowPaymentsSignatureVerifier signatureVerifier;
    private final String ipnSecretGetter; // referencia opaca a props para evitar leak en logs

    // Se inyecta directamente el objeto props para leer el ipn-secret en cada verify
    // (permite rotación runtime del secret sin reinicio).
    private final com.sharemechat.psp.config.NowPaymentsProperties props;

    public NowPaymentsPaymentProvider(NowPaymentsHttpClient httpClient,
                                      NowPaymentsSignatureVerifier signatureVerifier,
                                      com.sharemechat.psp.config.NowPaymentsProperties props) {
        this.httpClient = httpClient;
        this.signatureVerifier = signatureVerifier;
        this.props = props;
        this.ipnSecretGetter = "props"; // marca no-sensible; nunca loggear props.getIpnSecret()
    }

    @Override
    public String getProviderKey() {
        return PROVIDER_KEY;
    }

    @Override
    public CreateInvoiceResult createInvoice(CreateInvoiceRequest request) {
        JsonNode resp = httpClient.createInvoice(request);
        String id = textOrNull(resp, "id");
        String invoiceUrl = textOrNull(resp, "invoice_url");
        if (id == null || invoiceUrl == null) {
            throw new PspException("NOWPayments createInvoice response missing id/invoice_url: " + resp);
        }
        return new CreateInvoiceResult(id, invoiceUrl);
    }

    @Override
    public PaymentStatus getPaymentStatus(String providerPaymentId) {
        JsonNode resp = httpClient.getPaymentStatus(providerPaymentId);
        String raw = textOrNull(resp, "payment_status");
        return mapStatus(raw);
    }

    @Override
    public boolean verifyWebhookSignature(byte[] rawBody, Map<String, String> headers) {
        String provided = extractSignature(headers);
        return signatureVerifier.verify(props.getIpnSecret(), rawBody, provided);
    }

    @Override
    public WebhookEvent parseWebhook(byte[] rawBody) {
        try {
            JsonNode root = MAPPER.readTree(rawBody);

            // NOWPayments usa invoice_id como identificador estable del
            // contenedor de pago; payment_id es el intento concreto dentro
            // de esa invoice (cambia si el cliente reintenta con otra red).
            // Nuestro psp_transaction_id guarda el invoice_id que devolvio
            // POST /v1/invoice al crear el checkout - por eso el webhook
            // debe matchear por invoice_id.
            String paymentId = textOrNull(root, "invoice_id");
            String orderId = textOrNull(root, "order_id");
            String rawStatus = textOrNull(root, "payment_status");
            String eventType = null; // NOWPayments no expone event_type distinto; usamos payment_status

            // NOWPayments no envía event_id explícito → derivamos SHA-256(rawBody)
            // como sintético (patrón KycSessionService.processDiditWebhook:481-490).
            String eventId = sha256Hex(rawBody);

            PaymentStatus status = mapStatus(rawStatus);

            return new WebhookEvent(eventId, paymentId, eventType, orderId, status, rawStatus);
        } catch (Exception ex) {
            throw new PspException("NOWPayments parseWebhook error: " + ex.getMessage(), ex);
        }
    }

    /**
     * Traduce el status nativo del vendor a nuestro enum. Package-private
     * para tests unitarios.
     */
    PaymentStatus mapStatus(String raw) {
        if (raw == null) return PaymentStatus.PENDING;
        String s = raw.trim().toLowerCase(Locale.ROOT);
        switch (s) {
            case "waiting":
            case "confirming":
            case "confirmed":
            case "sending":
                return PaymentStatus.PENDING;
            case "finished":
                return PaymentStatus.SUCCESS;
            case "partially_paid":
            case "failed":
                return PaymentStatus.FAILED;
            case "refunded":
                return PaymentStatus.REFUNDED;
            case "expired":
                return PaymentStatus.EXPIRED;
            default:
                log.warn("[PSP-NOWPAYMENTS] status desconocido '{}' -> PENDING defensivo", raw);
                return PaymentStatus.PENDING;
        }
    }

    /**
     * Extrae la firma del map de headers (case-insensitive). Devuelve
     * null si no está presente. Package-private para tests.
     */
    String extractSignature(Map<String, String> headers) {
        if (headers == null || headers.isEmpty()) return null;
        for (Map.Entry<String, String> e : headers.entrySet()) {
            if (e.getKey() != null && SIGNATURE_HEADER.equalsIgnoreCase(e.getKey())) {
                return e.getValue();
            }
        }
        return null;
    }

    private String textOrNull(JsonNode node, String field) {
        if (node == null) return null;
        JsonNode f = node.get(field);
        if (f == null || f.isNull()) return null;
        // Aceptar numérico (algunos vendors devuelven id como int).
        return f.isTextual() ? f.asText() : f.asText();
    }

    /**
     * SHA-256 hex del body raw, para eventId sintético cuando el vendor
     * no envía uno. Determinista: mismo body → mismo id, dedup automático.
     */
    private String sha256Hex(byte[] data) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(data);
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16));
                sb.append(Character.forDigit(b & 0xF, 16));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new PspException("SHA-256 error: " + e.getMessage(), e);
        }
    }
}
