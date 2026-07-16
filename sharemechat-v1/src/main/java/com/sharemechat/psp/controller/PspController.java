package com.sharemechat.psp.controller;

import com.sharemechat.entity.PaymentSession;
import com.sharemechat.entity.User;
import com.sharemechat.psp.PspException;
import com.sharemechat.psp.config.NowPaymentsProperties;
import com.sharemechat.psp.service.PspOrchestratorService;
import com.sharemechat.repository.PaymentSessionRepository;
import com.sharemechat.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

/**
 * ADR-051 Fase 3: endpoints REST del subsistema PSP.
 *
 * <ul>
 *   <li>{@code POST /api/billing/nowpayments/checkout} - JWT auth,
 *       body {@code {packId}}, devuelve {@code {invoiceUrl, orderId, sessionId}}.
 *       El frontend redirige al {@code invoiceUrl} (hosted checkout NOWPayments).</li>
 *   <li>{@code GET /api/billing/session/{orderId}/status} - JWT auth,
 *       polling desde la página success_url. Devuelve status y campos
 *       mínimos para renderizar UI.</li>
 * </ul>
 *
 * <p>Errores:
 * <ul>
 *   <li>{@code 400} - packId inválido o body malformado.</li>
 *   <li>{@code 401} - sin auth (managed por SecurityConfig).</li>
 *   <li>{@code 403} - user no permitido por role.</li>
 *   <li>{@code 404} - orderId no encontrado en GET status.</li>
 *   <li>{@code 503 PSP_UNAVAILABLE} - kill-switch runtime OFF o provider caido.</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/billing")
public class PspController {

    private static final Logger log = LoggerFactory.getLogger(PspController.class);

    private final PspOrchestratorService orchestrator;
    private final UserRepository userRepository;
    private final PaymentSessionRepository paymentSessionRepository;
    private final NowPaymentsProperties nowPaymentsProperties;

    public PspController(PspOrchestratorService orchestrator,
                         UserRepository userRepository,
                         PaymentSessionRepository paymentSessionRepository,
                         NowPaymentsProperties nowPaymentsProperties) {
        this.orchestrator = orchestrator;
        this.userRepository = userRepository;
        this.paymentSessionRepository = paymentSessionRepository;
        this.nowPaymentsProperties = nowPaymentsProperties;
    }

    /**
     * Crea el checkout hosted en NOWPayments y devuelve la URL de redirect.
     */
    @PostMapping("/nowpayments/checkout")
    public ResponseEntity<Map<String, Object>> createNowPaymentsCheckout(
            Authentication auth, @RequestBody Map<String, String> body) {
        String packId = body != null ? body.get("packId") : null;
        Long userId = currentUserId(auth);

        try {
            PspOrchestratorService.BaseUrls urls = new PspOrchestratorService.BaseUrls(
                    nowPaymentsProperties.getIpnCallbackUrl(),
                    nowPaymentsProperties.getSuccessUrl(),
                    nowPaymentsProperties.getCancelUrl()
            );
            PspOrchestratorService.CheckoutResult result =
                    orchestrator.createCheckout(userId, "nowpayments", packId, urls);

            Map<String, Object> resp = new HashMap<>();
            resp.put("orderId", result.getOrderId());
            resp.put("invoiceUrl", result.getInvoiceUrl());
            resp.put("sessionId", result.getSessionId());
            return ResponseEntity.ok(resp);
        } catch (IllegalArgumentException iae) {
            log.warn("[PSP] checkout bad request userId={} packId={} err={}",
                    userId, packId, iae.getMessage());
            return ResponseEntity.badRequest().body(errorBody("BAD_REQUEST", iae.getMessage()));
        } catch (PspException pe) {
            log.warn("[PSP] checkout unavailable userId={} packId={} err={}",
                    userId, packId, pe.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(errorBody("PSP_UNAVAILABLE", pe.getMessage()));
        } catch (Exception ex) {
            log.error("[PSP] checkout error userId={} packId={}: {}",
                    userId, packId, ex.getMessage(), ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(errorBody("INTERNAL_ERROR", "Error creando el pago"));
        }
    }

    /**
     * Devuelve el status actual de una PaymentSession. Solo la puede leer
     * el usuario dueño de la fila (defensa contra polling ajeno).
     */
    @GetMapping("/session/{orderId}/status")
    public ResponseEntity<Map<String, Object>> getSessionStatus(
            Authentication auth, @PathVariable String orderId) {
        Long userId = currentUserId(auth);
        PaymentSession session = paymentSessionRepository.findByOrderId(orderId).orElse(null);
        if (session == null || session.getUser() == null || !userId.equals(session.getUser().getId())) {
            return ResponseEntity.notFound().build();
        }
        Map<String, Object> resp = new HashMap<>();
        resp.put("orderId", session.getOrderId());
        resp.put("status", session.getStatus());
        resp.put("packId", session.getPackId());
        resp.put("amount", session.getAmount());
        resp.put("currency", session.getCurrency());
        resp.put("provider", session.getProvider());
        return ResponseEntity.ok(resp);
    }

    private Long currentUserId(Authentication auth) {
        String email = auth.getName();
        User u = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado: " + email));
        return u.getId();
    }

    private Map<String, Object> errorBody(String code, String message) {
        Map<String, Object> m = new HashMap<>();
        m.put("code", code);
        m.put("message", message);
        return m;
    }
}
