package com.sharemechat.psp.service;

import com.sharemechat.entity.PaymentSession;
import com.sharemechat.psp.dto.PaymentStatus;
import com.sharemechat.psp.dto.WebhookEvent;
import com.sharemechat.psp.entity.PspWebhookEvent;
import com.sharemechat.psp.repository.PspWebhookEventRepository;
import com.sharemechat.repository.PaymentSessionRepository;
import com.sharemechat.service.TransactionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

/**
 * ADR-051 D3 + D9: orquestador del webhook IPN. Calcado del patrón
 * industrial ya probado en {@code KycSessionService.processDiditWebhook:438-498}
 * y adaptado al ciclo de vida de PSP + BFPM Fase 4A ([ADR-012](adr-012)).
 *
 * <p>Flujo {@link #processWebhook(String, byte[], Map)}:
 * <ol>
 *   <li>Resuelve {@link PaymentProvider} por providerKey.</li>
 *   <li>Verifica firma HMAC (delegado al provider concreto).</li>
 *   <li>Parsea a {@link WebhookEvent} vendor-agnostic.</li>
 *   <li>Dedup {@code UNIQUE(provider, provider_event_id)} vía
 *       {@code psp_webhook_events}. Si ya existe: return (no-op idempotente).</li>
 *   <li>Persiste el evento en {@code psp_webhook_events} SIEMPRE (con
 *       {@code signatureValid}/{@code processed} correspondiente para auditoria).</li>
 *   <li>Si {@code payment_status == SUCCESS} (finished): adquiere lock
 *       {@code SELECT FOR UPDATE} sobre {@code payment_sessions.psp_transaction_id}
 *       y ejecuta {@link TransactionService#creditPackWithBonus} con
 *       cálculo BFPM del bonus. Marca evento processed=true.</li>
 *   <li>Otros statuses (FAILED, EXPIRED, REFUNDED, PENDING): solo actualiza
 *       {@code payment_sessions.status} y marca evento processed=true.</li>
 * </ol>
 *
 * <p>El método devuelve {@code true} si el evento se persiste (aunque sea
 * como rechazado por firma) o si es duplicado; {@code false} solo si
 * ocurre un error catastrófico ANTES de persistir (fallo BD conectividad,
 * etc). Este contrato permite al controller responder 200 en la mayoría
 * de casos y solo 500 ante fallo real de sistema.
 */
@Service
public class PspWebhookOrchestratorService {

    private static final Logger log = LoggerFactory.getLogger(PspWebhookOrchestratorService.class);

    /**
     * ADR-011 BFPM Fase 4A: tabla de bonus por pack. Mismo catálogo que
     * ADR-012 D2/D3.
     */
    private static final java.util.Map<String, BigDecimal> PACK_BONUS = java.util.Map.of(
            "P10", new BigDecimal("0.00"),
            "P20", new BigDecimal("2.00"),
            "P40", new BigDecimal("4.00")
    );

    private final PaymentProviderRegistry providerRegistry;
    private final PspWebhookEventRepository webhookEventRepository;
    private final PaymentSessionRepository paymentSessionRepository;
    private final TransactionService transactionService;

    public PspWebhookOrchestratorService(PaymentProviderRegistry providerRegistry,
                                         PspWebhookEventRepository webhookEventRepository,
                                         PaymentSessionRepository paymentSessionRepository,
                                         TransactionService transactionService) {
        this.providerRegistry = providerRegistry;
        this.webhookEventRepository = webhookEventRepository;
        this.paymentSessionRepository = paymentSessionRepository;
        this.transactionService = transactionService;
    }

    @Transactional
    public boolean processWebhook(String providerKey, byte[] rawBody, Map<String, String> headers) {
        byte[] safeBytes = rawBody == null ? new byte[0] : rawBody;
        String rawBodyStr = new String(safeBytes, StandardCharsets.UTF_8);

        // 1. Provider.
        Optional<PaymentProvider> providerOpt = providerRegistry.find(providerKey);
        if (providerOpt.isEmpty()) {
            log.warn("[PSP-WEBHOOK] provider no registrado: {}", providerKey);
            return false;
        }
        PaymentProvider provider = providerOpt.get();

        // 2. Firma. Persistimos rechazo si inválida.
        boolean signatureValid = provider.verifyWebhookSignature(safeBytes, headers);
        if (!signatureValid) {
            persistRejection(providerKey, rawBodyStr, "invalid_signature");
            log.warn("[PSP-WEBHOOK] firma invalida provider={}", providerKey);
            return true; // el rechazo se persiste; controller responde 200 para no incentivar retries
        }

        // 3. Parse.
        WebhookEvent event;
        try {
            event = provider.parseWebhook(safeBytes);
        } catch (Exception ex) {
            persistRejection(providerKey, rawBodyStr, "parse_error:" + safeMsg(ex));
            log.warn("[PSP-WEBHOOK] parse error provider={} err={}", providerKey, ex.getMessage());
            return true;
        }

        // 4. Dedup UNIQUE(provider, provider_event_id).
        String eventId = event.getProviderEventId();
        if (eventId != null) {
            Optional<PspWebhookEvent> existing =
                    webhookEventRepository.findByProviderAndProviderEventId(providerKey, eventId);
            if (existing.isPresent()) {
                log.info("[PSP-WEBHOOK] duplicado dedup provider={} eventId={}", providerKey, eventId);
                return true;
            }
        }

        // 5. Persistir (aún no processed).
        PspWebhookEvent evRow = new PspWebhookEvent();
        evRow.setProvider(providerKey);
        evRow.setProviderEventId(eventId);
        evRow.setProviderPaymentId(event.getProviderPaymentId());
        evRow.setProviderEventType(event.getProviderEventType());
        evRow.setPaymentStatus(event.getRawPaymentStatus());
        evRow.setSignatureValid(true);
        evRow.setPayloadJson(rawBodyStr);

        try {
            handleStatus(providerKey, event, evRow);
            evRow.setProcessed(true);
            evRow.setProcessedAt(LocalDateTime.now());
        } catch (Exception ex) {
            evRow.setProcessed(false);
            evRow.setProcessedAt(LocalDateTime.now());
            evRow.setProcessingErrorMessage(truncate("handle_error:" + safeMsg(ex), 500));
            log.error("[PSP-WEBHOOK] handle FAIL provider={} eventId={} err={}",
                    providerKey, eventId, ex.getMessage(), ex);
        }
        webhookEventRepository.save(evRow);
        return true;
    }

    /**
     * Núcleo de la lógica post-parse. Aplica el cambio derivado del status
     * al {@code payment_sessions}. En SUCCESS (finished) invoca
     * {@link TransactionService#creditPackWithBonus} con lock pesimista
     * para evitar doble crédito.
     */
    private void handleStatus(String providerKey, WebhookEvent event, PspWebhookEvent evRow) {
        String pspTxId = event.getProviderPaymentId();
        if (pspTxId == null || pspTxId.isBlank()) {
            throw new IllegalStateException("providerPaymentId ausente en payload");
        }

        // Lock SELECT FOR UPDATE sobre la sesion (ADR-051 D9).
        Optional<PaymentSession> sessionOpt =
                paymentSessionRepository.findByProviderAndPspTransactionIdForUpdate(providerKey, pspTxId);
        if (sessionOpt.isEmpty()) {
            throw new IllegalStateException(
                    "PaymentSession no encontrada provider=" + providerKey + " pspTx=" + pspTxId);
        }
        PaymentSession session = sessionOpt.get();

        PaymentStatus status = event.getPaymentStatus();
        switch (status) {
            case SUCCESS:
                // Idempotencia extra: si la session ya está SUCCESS, no re-creditar.
                if ("SUCCESS".equals(session.getStatus())) {
                    log.info("[PSP-WEBHOOK] session ya SUCCESS, skip credit provider={} pspTx={}",
                            providerKey, pspTxId);
                    return;
                }
                BigDecimal price = session.getAmount();
                BigDecimal bonus = PACK_BONUS.getOrDefault(session.getPackId(), BigDecimal.ZERO);
                transactionService.creditPackWithBonus(
                        session.getUser().getId(),
                        price, bonus,
                        session.getOrderId(),
                        session.getPackId(),
                        session.isFirstPayment(),
                        providerKey);
                session.setStatus("SUCCESS");
                paymentSessionRepository.save(session);
                log.info("[PSP-WEBHOOK] credited provider={} pspTx={} orderId={} pack={} price={} bonus={}",
                        providerKey, pspTxId, session.getOrderId(), session.getPackId(), price, bonus);
                break;
            case FAILED:
                session.setStatus("FAILED");
                paymentSessionRepository.save(session);
                break;
            case EXPIRED:
                session.setStatus("EXPIRED");
                paymentSessionRepository.save(session);
                break;
            case REFUNDED:
                // #D-35 politica refund con bonus pendiente. Por ahora solo marca.
                session.setStatus("REFUNDED");
                paymentSessionRepository.save(session);
                log.warn("[PSP-WEBHOOK] REFUNDED recibido, requiere politica manual #D-35 provider={} orderId={}",
                        providerKey, session.getOrderId());
                break;
            case PENDING:
            default:
                // No-op sobre la session; log informativo.
                log.info("[PSP-WEBHOOK] status intermedio {} provider={} orderId={} (session queda PENDING)",
                        event.getRawPaymentStatus(), providerKey, session.getOrderId());
                break;
        }
    }

    private void persistRejection(String providerKey, String rawBody, String errorMsg) {
        try {
            PspWebhookEvent ev = new PspWebhookEvent();
            ev.setProvider(providerKey);
            // Sin providerEventId real: derivamos synthetic sha256 aqui tambien
            // para que la UNIQUE constraint no bloquee rechazos anonimos.
            ev.setProviderEventId(deriveSyntheticId(rawBody));
            ev.setPayloadJson(rawBody);
            ev.setSignatureValid(false);
            ev.setProcessed(false);
            ev.setProcessedAt(LocalDateTime.now());
            ev.setProcessingErrorMessage(truncate(errorMsg, 500));
            webhookEventRepository.save(ev);
        } catch (Exception ex) {
            log.error("[PSP-WEBHOOK] persist rejection FAIL provider={}: {}", providerKey, ex.getMessage(), ex);
        }
    }

    private String deriveSyntheticId(String rawBody) {
        try {
            byte[] hash = java.security.MessageDigest.getInstance("SHA-256")
                    .digest(rawBody.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16));
                sb.append(Character.forDigit(b & 0xF, 16));
            }
            return "synth_" + sb.toString();
        } catch (Exception e) {
            return "synth_error_" + System.nanoTime();
        }
    }

    private String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }

    private String safeMsg(Throwable t) {
        String m = t.getMessage();
        return m == null ? t.getClass().getSimpleName() : m;
    }
}
