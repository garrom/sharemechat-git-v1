package com.sharemechat.psp.provider.nowpayments;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sharemechat.psp.PspException;
import com.sharemechat.psp.config.NowPaymentsProperties;
import com.sharemechat.psp.dto.CreateInvoiceRequest;
import com.sharemechat.psp.dto.CreateInvoiceResult;
import com.sharemechat.psp.dto.PaymentStatus;
import com.sharemechat.psp.dto.WebhookEvent;
import com.sharemechat.security.HmacSha512;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Tests unitarios de {@link NowPaymentsPaymentProvider}. Foco:
 * (a) mapping de status vendor → enum interno,
 * (b) extracción case-insensitive del header de firma,
 * (c) createInvoice: mocking del HttpClient para verificar mapping DTO,
 * (d) parseWebhook: eventId sintético SHA-256, orderId/paymentId extraídos,
 * (e) verifyWebhookSignature end-to-end con el verifier real.
 */
class NowPaymentsPaymentProviderTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private NowPaymentsHttpClient httpClient;
    private NowPaymentsSignatureVerifier signatureVerifier;
    private NowPaymentsProperties props;
    private NowPaymentsPaymentProvider provider;

    @BeforeEach
    void setUp() {
        httpClient = mock(NowPaymentsHttpClient.class);
        signatureVerifier = new NowPaymentsSignatureVerifier(); // real, no mock
        props = new NowPaymentsProperties();
        props.setIpnSecret("test-ipn-secret-xyz");
        provider = new NowPaymentsPaymentProvider(httpClient, signatureVerifier, props);
    }

    @Test
    @DisplayName("getProviderKey devuelve 'nowpayments' (contract con psp_provider_config)")
    void provider_key() {
        assertEquals("nowpayments", provider.getProviderKey());
    }

    // ==================== mapStatus ====================

    @Test
    @DisplayName("mapStatus: waiting/confirming/confirmed/sending → PENDING")
    void mapStatus_pending_variants() {
        assertEquals(PaymentStatus.PENDING, provider.mapStatus("waiting"));
        assertEquals(PaymentStatus.PENDING, provider.mapStatus("confirming"));
        assertEquals(PaymentStatus.PENDING, provider.mapStatus("confirmed"));
        assertEquals(PaymentStatus.PENDING, provider.mapStatus("sending"));
    }

    @Test
    @DisplayName("mapStatus: finished → SUCCESS")
    void mapStatus_success() {
        assertEquals(PaymentStatus.SUCCESS, provider.mapStatus("finished"));
    }

    @Test
    @DisplayName("mapStatus: failed y partially_paid → FAILED")
    void mapStatus_failed() {
        assertEquals(PaymentStatus.FAILED, provider.mapStatus("failed"));
        assertEquals(PaymentStatus.FAILED, provider.mapStatus("partially_paid"));
    }

    @Test
    @DisplayName("mapStatus: refunded → REFUNDED, expired → EXPIRED")
    void mapStatus_refunded_expired() {
        assertEquals(PaymentStatus.REFUNDED, provider.mapStatus("refunded"));
        assertEquals(PaymentStatus.EXPIRED, provider.mapStatus("expired"));
    }

    @Test
    @DisplayName("mapStatus: null y desconocido → PENDING defensivo")
    void mapStatus_null_or_unknown_defensive() {
        assertEquals(PaymentStatus.PENDING, provider.mapStatus(null));
        assertEquals(PaymentStatus.PENDING, provider.mapStatus("wat"));
    }

    @Test
    @DisplayName("mapStatus: case-insensitive (WAITING, Finished, REFUNDED)")
    void mapStatus_case_insensitive() {
        assertEquals(PaymentStatus.PENDING, provider.mapStatus("WAITING"));
        assertEquals(PaymentStatus.SUCCESS, provider.mapStatus("Finished"));
        assertEquals(PaymentStatus.REFUNDED, provider.mapStatus("REFUNDED"));
    }

    // ==================== extractSignature ====================

    @Test
    @DisplayName("extractSignature encuentra header case-insensitive")
    void extract_signature_case_insensitive() {
        Map<String, String> h1 = new HashMap<>();
        h1.put("x-nowpayments-sig", "abc123");
        assertEquals("abc123", provider.extractSignature(h1));

        Map<String, String> h2 = new HashMap<>();
        h2.put("X-NOWPayments-Sig", "xyz789");
        assertEquals("xyz789", provider.extractSignature(h2));

        Map<String, String> h3 = new HashMap<>();
        h3.put("X-NOWPAYMENTS-SIG", "upper");
        assertEquals("upper", provider.extractSignature(h3));
    }

    @Test
    @DisplayName("extractSignature devuelve null si el header no está")
    void extract_signature_missing_returns_null() {
        Map<String, String> h = new HashMap<>();
        h.put("content-type", "application/json");
        assertNull(provider.extractSignature(h));
        assertNull(provider.extractSignature(null));
        assertNull(provider.extractSignature(new HashMap<>()));
    }

    // ==================== createInvoice ====================

    @Test
    @DisplayName("createInvoice extrae id + invoice_url de la respuesta del vendor")
    void create_invoice_maps_response() throws Exception {
        JsonNode fakeResp = MAPPER.readTree(
                "{\"id\":\"42\",\"invoice_url\":\"https://invoice.nowpayments.io/abc\",\"order_id\":\"UUID-1\"}");
        when(httpClient.createInvoice(any(CreateInvoiceRequest.class))).thenReturn(fakeResp);

        CreateInvoiceRequest req = new CreateInvoiceRequest(
                "UUID-1", "SharemeChat - Pack P10 (test)",
                new BigDecimal("10.00"), "eur", null, null,
                "https://test.sharemechat.com/api/webhooks/nowpayments/ipn",
                "https://test.sharemechat.com/checkout/success",
                "https://test.sharemechat.com/checkout/cancel");

        CreateInvoiceResult result = provider.createInvoice(req);
        assertNotNull(result);
        assertEquals("42", result.getProviderPaymentId());
        assertEquals("https://invoice.nowpayments.io/abc", result.getInvoiceUrl());
    }

    @Test
    @DisplayName("createInvoice lanza PspException si la respuesta no trae id o invoice_url")
    void create_invoice_missing_fields_throws() throws Exception {
        JsonNode fakeResp = MAPPER.readTree("{\"order_id\":\"UUID-2\"}"); // sin id ni invoice_url
        when(httpClient.createInvoice(any(CreateInvoiceRequest.class))).thenReturn(fakeResp);

        CreateInvoiceRequest req = new CreateInvoiceRequest(
                "UUID-2", "desc", new BigDecimal("10.00"), "eur", null, null,
                "ipn", "success", "cancel");

        assertThrows(PspException.class, () -> provider.createInvoice(req));
    }

    // ==================== getPaymentStatus ====================

    @Test
    @DisplayName("getPaymentStatus lee payment_status y lo mapea al enum")
    void get_payment_status_maps() throws Exception {
        JsonNode fakeResp = MAPPER.readTree(
                "{\"payment_id\":\"42\",\"payment_status\":\"finished\",\"order_id\":\"UUID-1\"}");
        when(httpClient.getPaymentStatus(eq("42"))).thenReturn(fakeResp);

        assertEquals(PaymentStatus.SUCCESS, provider.getPaymentStatus("42"));
    }

    // ==================== parseWebhook ====================

    @Test
    @DisplayName("parseWebhook extrae invoice_id (no payment_id), order_id, mapStatus y deriva eventId sintético")
    void parse_webhook_extracts_and_synthesizes_event_id() {
        // Fase 4h: NOWPayments usa invoice_id como identificador estable
        // del contenedor de pago. payment_id es el intento concreto
        // dentro de esa invoice y no matchea con nuestro
        // payment_sessions.psp_transaction_id.
        String rawBody = "{\"invoice_id\":42,\"payment_id\":99,\"order_id\":\"UUID-abc\",\"payment_status\":\"waiting\"}";
        WebhookEvent evt = provider.parseWebhook(rawBody.getBytes(StandardCharsets.UTF_8));

        assertNotNull(evt);
        assertEquals("42", evt.getProviderPaymentId()); // invoice_id, no payment_id
        assertEquals("UUID-abc", evt.getOrderId());
        assertEquals(PaymentStatus.PENDING, evt.getPaymentStatus());
        assertEquals("waiting", evt.getRawPaymentStatus());

        // eventId sintético = SHA-256 hex del rawBody (64 chars, deterministic)
        assertNotNull(evt.getProviderEventId());
        assertEquals(64, evt.getProviderEventId().length());
    }

    @Test
    @DisplayName("parseWebhook: eventId sintético es determinista (mismo body → mismo id)")
    void parse_webhook_event_id_deterministic() {
        String rawBody = "{\"invoice_id\":1,\"order_id\":\"o\",\"payment_status\":\"finished\"}";
        WebhookEvent e1 = provider.parseWebhook(rawBody.getBytes(StandardCharsets.UTF_8));
        WebhookEvent e2 = provider.parseWebhook(rawBody.getBytes(StandardCharsets.UTF_8));
        assertEquals(e1.getProviderEventId(), e2.getProviderEventId());
    }

    // ==================== verifyWebhookSignature (end-to-end con verifier real) ====================

    @Test
    @DisplayName("verifyWebhookSignature OK con firma calculada sobre rawBody y header lowercase")
    void verify_webhook_signature_valid() {
        // Fase 4h: firma se calcula sobre rawBody directamente, sin
        // canonicalizar.
        String rawBody = "{\"payment_status\":\"finished\",\"invoice_id\":42}";
        String sig = HmacSha512.hexHmacSha512(props.getIpnSecret(), rawBody.getBytes(StandardCharsets.UTF_8));

        Map<String, String> headers = new HashMap<>();
        headers.put("x-nowpayments-sig", sig);

        assertTrue(provider.verifyWebhookSignature(rawBody.getBytes(StandardCharsets.UTF_8), headers));
    }

    @Test
    @DisplayName("verifyWebhookSignature FAIL si el header falta")
    void verify_webhook_signature_missing_header() {
        String rawBody = "{\"a\":1}";
        Map<String, String> headers = new HashMap<>();
        headers.put("content-type", "application/json");
        assertFalse(provider.verifyWebhookSignature(rawBody.getBytes(StandardCharsets.UTF_8), headers));
    }

    @Test
    @DisplayName("verifyWebhookSignature FAIL si el ipn-secret está vacío")
    void verify_webhook_signature_no_secret() {
        props.setIpnSecret(""); // secret blank
        String rawBody = "{\"a\":1}";
        Map<String, String> headers = new HashMap<>();
        headers.put("x-nowpayments-sig", "anything");
        assertFalse(provider.verifyWebhookSignature(rawBody.getBytes(StandardCharsets.UTF_8), headers));
    }
}
