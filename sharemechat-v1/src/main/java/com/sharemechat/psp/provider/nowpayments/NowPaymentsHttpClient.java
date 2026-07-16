package com.sharemechat.psp.provider.nowpayments;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sharemechat.psp.PspException;
import com.sharemechat.psp.config.NowPaymentsProperties;
import com.sharemechat.psp.dto.CreateInvoiceRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * ADR-051 Fase 2: adapter HTTP al API de NOWPayments.
 *
 * <p>Auth: header {@code x-api-key}. Timeouts controlados via
 * {@link NowPaymentsProperties} (default 5s connect / 10s read).
 * Rutas de la Invoice API:
 * <ul>
 *   <li>{@code POST /v1/invoice} — crea invoice hosted.</li>
 *   <li>{@code GET  /v1/payment/{id}} — consulta status de un pago.</li>
 *   <li>{@code GET  /v1/status} — health check.</li>
 * </ul>
 *
 * <p>Este cliente devuelve {@link JsonNode} raw; el mapping a DTOs
 * vendor-agnostic lo hace {@link NowPaymentsPaymentProvider}. Separación
 * client vs provider deliberada para facilitar tests unitarios (mock del
 * client sin tocar HTTP real).
 *
 * <p>Sobre autenticación en fase de arranque: {@link #healthCheck()} NO
 * requiere API key ({@code GET /v1/status}); usable como probe sin
 * credenciales. Los demás sí requieren {@code x-api-key} válida.
 */
@Component
public class NowPaymentsHttpClient {

    private static final Logger log = LoggerFactory.getLogger(NowPaymentsHttpClient.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final NowPaymentsProperties props;
    private final RestTemplate restTemplate;

    public NowPaymentsHttpClient(NowPaymentsProperties props) {
        this.props = props;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(props.getConnectTimeoutMs());
        factory.setReadTimeout(props.getReadTimeoutMs());
        this.restTemplate = new RestTemplate(factory);
    }

    /**
     * {@code POST /v1/invoice}. Devuelve el nodo raw con al menos los
     * campos {@code id}, {@code invoice_url}, {@code order_id}.
     *
     * @throws PspException si credenciales blank, timeout, 4xx, 5xx.
     */
    public JsonNode createInvoice(CreateInvoiceRequest req) {
        requireApiKey();

        // Ordenamos con LinkedHashMap para request estable en logs y tests.
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("price_amount", req.getPriceAmount());
        body.put("price_currency", req.getPriceCurrency());
        if (req.getPayCurrency() != null && !req.getPayCurrency().isBlank()) {
            body.put("pay_currency", req.getPayCurrency());
        }
        body.put("order_id", req.getOrderId());
        body.put("order_description", req.getOrderDescription());
        body.put("ipn_callback_url", req.getIpnCallbackUrl());
        body.put("success_url", req.getSuccessUrl());
        body.put("cancel_url", req.getCancelUrl());

        HttpHeaders headers = jsonHeaders();
        String url = joinUrl(props.getBaseUrl(), "invoice");

        try {
            ResponseEntity<String> resp = restTemplate.exchange(
                    url, HttpMethod.POST, new HttpEntity<>(body, headers), String.class);
            if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
                throw new PspException("NOWPayments createInvoice HTTP " + resp.getStatusCodeValue());
            }
            return MAPPER.readTree(resp.getBody());
        } catch (PspException pe) {
            throw pe;
        } catch (Exception ex) {
            throw new PspException("NOWPayments createInvoice error: " + ex.getMessage(), ex);
        }
    }

    /**
     * {@code GET /v1/payment/{id}}. Devuelve el nodo raw con al menos
     * {@code payment_status}, {@code payment_id}, {@code order_id}.
     */
    public JsonNode getPaymentStatus(String providerPaymentId) {
        if (providerPaymentId == null || providerPaymentId.isBlank()) {
            throw new IllegalArgumentException("providerPaymentId required");
        }
        requireApiKey();

        HttpHeaders headers = jsonHeaders();
        String url = joinUrl(props.getBaseUrl(), "payment/" + providerPaymentId);

        try {
            ResponseEntity<String> resp = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers), String.class);
            if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
                throw new PspException("NOWPayments getPaymentStatus HTTP " + resp.getStatusCodeValue());
            }
            return MAPPER.readTree(resp.getBody());
        } catch (PspException pe) {
            throw pe;
        } catch (Exception ex) {
            throw new PspException("NOWPayments getPaymentStatus error: " + ex.getMessage(), ex);
        }
    }

    /**
     * {@code GET /v1/status}. Health check público, NO requiere x-api-key.
     * Devuelve {@code true} si status HTTP 2xx y body contiene
     * {@code "message":"OK"} o similar.
     */
    public boolean healthCheck() {
        String url = joinUrl(props.getBaseUrl(), "status");
        try {
            ResponseEntity<String> resp = restTemplate.getForEntity(url, String.class);
            return resp.getStatusCode().is2xxSuccessful();
        } catch (Exception ex) {
            log.warn("[PSP-NOWPAYMENTS] healthCheck fail: {}", ex.getMessage());
            return false;
        }
    }

    private HttpHeaders jsonHeaders() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        h.setAccept(java.util.Collections.singletonList(MediaType.APPLICATION_JSON));
        h.set("x-api-key", props.getApiKey());
        return h;
    }

    private void requireApiKey() {
        if (props.getApiKey() == null || props.getApiKey().isBlank()) {
            throw new PspException("NOWPayments api-key not configured");
        }
    }

    private String joinUrl(String base, String path) {
        String b = base.endsWith("/") ? base : base + "/";
        String p = path.startsWith("/") ? path.substring(1) : path;
        return b + p;
    }
}
