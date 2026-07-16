package com.sharemechat.psp.controller;

import com.sharemechat.psp.service.PspWebhookOrchestratorService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Enumeration;
import java.util.HashMap;
import java.util.Map;

/**
 * ADR-051 Fase 3: endpoint público del webhook IPN de PSPs.
 *
 * <p>Contrato:
 * <ul>
 *   <li>{@code POST /api/webhooks/nowpayments/ipn} - {@code permitAll} en
 *       SecurityConfig. Firma HMAC-SHA512 validada en el orchestrator
 *       via {@link PspWebhookOrchestratorService#processWebhook(String, byte[], Map)}.</li>
 * </ul>
 *
 * <p>Body como {@code byte[]} (raw preservado) - CRÍTICO para que la firma
 * HMAC calculada localmente coincida con la del vendor (cualquier
 * transformación intermedia rompería la firma).
 *
 * <p>Siempre respondemos {@code 200 OK} salvo error catastrófico
 * pre-persist (no BD, etc). Rechazos por firma inválida se persisten
 * silenciosamente en {@code psp_webhook_events} para auditoría y
 * respondemos 200 para no incentivar retries del vendor.
 *
 * <p>Patrón calcado de {@code /api/kyc/didit/webhook} +
 * {@code /api/webhooks/moderation/*}. Endpoint específico por vendor
 * (D4) en lugar de genérico {@code /api/webhooks/psp/{provider}}.
 */
@RestController
@RequestMapping("/api/webhooks")
public class PspWebhookController {

    private static final Logger log = LoggerFactory.getLogger(PspWebhookController.class);

    private final PspWebhookOrchestratorService orchestrator;

    public PspWebhookController(PspWebhookOrchestratorService orchestrator) {
        this.orchestrator = orchestrator;
    }

    @PostMapping("/nowpayments/ipn")
    public ResponseEntity<String> receiveNowPayments(
            @RequestBody(required = false) byte[] rawBody,
            HttpServletRequest request) {
        Map<String, String> headers = copyHeaders(request);
        try {
            boolean handled = orchestrator.processWebhook("nowpayments", rawBody, headers);
            if (!handled) {
                // Fallo catastrófico pre-persist. 500 para que el vendor
                // reintente.
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("error");
            }
            return ResponseEntity.ok("ok");
        } catch (Exception ex) {
            log.error("[PSP-WEBHOOK] receive error: {}", ex.getMessage(), ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("error");
        }
    }

    /**
     * Copia headers del request a {@code Map<String, String>} para no
     * acoplar el orchestrator a la API servlet. Case-preserving; el
     * orchestrator busca case-insensitive.
     */
    private Map<String, String> copyHeaders(HttpServletRequest request) {
        Map<String, String> map = new HashMap<>();
        Enumeration<String> names = request.getHeaderNames();
        if (names == null) return map;
        while (names.hasMoreElements()) {
            String name = names.nextElement();
            if (name != null) {
                map.put(name, request.getHeader(name));
            }
        }
        return map;
    }
}
