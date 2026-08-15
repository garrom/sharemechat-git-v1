package com.sharemechat.psp.service;

import com.sharemechat.entity.Client;
import com.sharemechat.entity.PaymentSession;
import com.sharemechat.handler.MessagesWsHandlerSupport;
import com.sharemechat.psp.dto.PaymentStatus;
import com.sharemechat.psp.dto.WebhookEvent;
import com.sharemechat.psp.entity.PspWebhookEvent;
import com.sharemechat.psp.repository.PspWebhookEventRepository;
import com.sharemechat.repository.ClientRepository;
import com.sharemechat.repository.PaymentSessionRepository;
import com.sharemechat.service.TransactionService;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Locale;
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
            "P40", new BigDecimal("4.00"),
            // #D-24 parcial (2026-07-25): pack premium P100 con bonus 12%
            // (12 EUR sobre 100). Incremento de 2 puntos respecto al 10% de
            // P20/P40 siguiendo la escala pedida por el operador.
            "P100", new BigDecimal("12.00")
    );

    /**
     * ADR-053 (revisado 2026-08-15): tolerancia para partially_paid cripto
     * con criterio por rango de pack. El margen que la plataforma asume en
     * un parcial es el MAYOR de:
     *   - {@link #PARTIAL_TOLERANCE_PCT} del importe del pack (3%), y
     *   - {@link #PARTIAL_MIN_ABS_EUR} (suelo 0,50 EUR, para que P10 no
     *     quede demasiado justo: 3% de 10 EUR = 0,30 EUR),
     * y NUNCA por encima de {@link #PARTIAL_MAX_ABS_EUR} (techo 5 EUR,
     * guarda anti-fuga/anti-abuso; cubre packs futuros mayores). Se sube de
     * 1% a 3% porque el fee cripto (~0,5-1%) deja margen holgado frente a un
     * PSP tarjeta (~13%), reduciendo rechazos por micro-fluctuacion EUR/cripto.
     * Margen maximo por pack actual: P10 0,50€ · P20 0,60€ · P40 1,20€ · P100 3,00€.
     */
    private static final BigDecimal PARTIAL_TOLERANCE_PCT = new BigDecimal("0.03");
    private static final BigDecimal PARTIAL_MIN_ABS_EUR = new BigDecimal("0.50");
    private static final BigDecimal PARTIAL_MAX_ABS_EUR = new BigDecimal("5.00");

    private final PaymentProviderRegistry providerRegistry;
    private final PspWebhookEventRepository webhookEventRepository;
    private final PaymentSessionRepository paymentSessionRepository;
    private final TransactionService transactionService;
    private final ClientRepository clientRepository;
    private final MessagesWsHandlerSupport wsSupport;

    public PspWebhookOrchestratorService(PaymentProviderRegistry providerRegistry,
                                         PspWebhookEventRepository webhookEventRepository,
                                         PaymentSessionRepository paymentSessionRepository,
                                         TransactionService transactionService,
                                         ClientRepository clientRepository,
                                         MessagesWsHandlerSupport wsSupport) {
        this.providerRegistry = providerRegistry;
        this.webhookEventRepository = webhookEventRepository;
        this.paymentSessionRepository = paymentSessionRepository;
        this.transactionService = transactionService;
        this.clientRepository = clientRepository;
        this.wsSupport = wsSupport;
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
            // Debug info sin exponer secretos: primeros chars del header
            // recibido (para saber si llego o no) + SHA-256 del body
            // (para poder reproducir la firma manualmente en debug).
            String sigHeaderShort = firstHeaderChars(headers, 12);
            log.warn("[PSP-WEBHOOK] firma invalida provider={} bodyLen={} sigHeaderPrefix='{}' bodySha256={}",
                    providerKey, safeBytes.length, sigHeaderShort, shortSha256(safeBytes));
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
                creditAndNotify(session, providerKey, pspTxId, "finished");
                break;
            case FAILED:
                // ADR-053 (revisado 2026-08-15): tolerancia para pagos
                // parciales cripto por fluctuacion de tipo de cambio entre
                // creacion de invoice y confirmacion del pago. Si el vendor
                // marca "partially_paid" pero la diferencia en EUR entra en
                // el margen de isPartialWithinTolerance (max(3% del pack,
                // 0,50€), topado a 5€), tratamos como SUCCESS y acreditamos
                // el pack completo. La plataforma absorbe la pequenya
                // diferencia como coste de volatilidad cripto.
                if ("partially_paid".equalsIgnoreCase(event.getRawPaymentStatus())
                        && isPartialWithinTolerance(session, event, providerKey, pspTxId)) {
                    creditAndNotify(session, providerKey, pspTxId, "partial_within_tolerance");
                    break;
                }
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

    /**
     * Busca en el mapa de headers (case-insensitive) alguna cabecera que
     * empiece por "x-*-sig" y devuelve los primeros N chars del valor.
     * Solo para logs de debug - nunca imprimir la firma completa.
     */
    private String firstHeaderChars(Map<String, String> headers, int n) {
        if (headers == null) return "null";
        for (Map.Entry<String, String> e : headers.entrySet()) {
            String k = e.getKey();
            if (k == null) continue;
            String kl = k.toLowerCase(Locale.ROOT);
            if (kl.startsWith("x-") && kl.contains("sig")) {
                String v = e.getValue();
                if (v == null) return "null-value";
                return v.length() <= n ? v : v.substring(0, n) + "...";
            }
        }
        return "missing";
    }

    private String shortSha256(byte[] bytes) {
        try {
            byte[] hash = java.security.MessageDigest.getInstance("SHA-256").digest(bytes);
            StringBuilder sb = new StringBuilder(16);
            for (int i = 0; i < 8 && i < hash.length; i++) {
                sb.append(Character.forDigit((hash[i] >> 4) & 0xF, 16));
                sb.append(Character.forDigit(hash[i] & 0xF, 16));
            }
            return sb.toString();
        } catch (Exception e) {
            return "sha-err";
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

    /**
     * ADR-053: acredita el pack completo (price + bonus) al usuario
     * asociado a la session y emite WS wallet:credited al frontend.
     * Reutilizable desde el flujo estandar SUCCESS y desde el flujo
     * "partial dentro de tolerancia". El parametro {@code creditReason}
     * queda en el log para trazabilidad ("finished" vs
     * "partial_within_tolerance").
     */
    private void creditAndNotify(PaymentSession session, String providerKey,
                                 String pspTxId, String creditReason) {
        // Idempotencia extra: si la session ya está SUCCESS, no re-creditar.
        if ("SUCCESS".equals(session.getStatus())) {
            log.info("[PSP-WEBHOOK] session ya SUCCESS, skip credit provider={} pspTx={}",
                    providerKey, pspTxId);
            return;
        }
        BigDecimal price = session.getAmount();
        BigDecimal bonus = PACK_BONUS.getOrDefault(session.getPackId(), BigDecimal.ZERO);
        Long creditedUserId = session.getUser().getId();
        transactionService.creditPackWithBonus(
                creditedUserId,
                price, bonus,
                session.getOrderId(),
                session.getPackId(),
                session.isFirstPayment(),
                providerKey);
        session.setStatus("SUCCESS");
        paymentSessionRepository.save(session);
        log.info("[PSP-WEBHOOK] credited provider={} pspTx={} orderId={} pack={} price={} bonus={} reason={}",
                providerKey, pspTxId, session.getOrderId(), session.getPackId(),
                price, bonus, creditReason);
        // Notificar al frontend en vivo (patron introducido 2026-07-25).
        try {
            clientRepository.findById(creditedUserId).ifPresent(client -> {
                BigDecimal newBalance = client.getSaldoActual();
                if (newBalance != null) {
                    String payload = new JSONObject()
                            .put("type", "wallet:credited")
                            .put("newBalance", newBalance.toPlainString())
                            .put("orderId", session.getOrderId())
                            .put("packId", session.getPackId())
                            .toString();
                    wsSupport.notifyUserById(creditedUserId, payload);
                    log.info("[PSP-WEBHOOK] wallet:credited emitted userId={} newBalance={}",
                            creditedUserId, newBalance);
                }
            });
        } catch (Exception wsEx) {
            log.warn("[PSP-WEBHOOK] wallet:credited notify FAIL userId={}: {}",
                    creditedUserId, wsEx.getMessage());
        }
    }

    /**
     * ADR-053 (revisado 2026-08-15): decide si un pago "partially_paid"
     * del vendor cumple la tolerancia para acreditar el pack completo.
     * Regla: la diferencia en EUR (aprox: price_eur * (1 - ratio_cripto))
     * debe ser <= max(3% del pack, 0,50€), topado a 5€ — ver constantes
     * {@link #PARTIAL_TOLERANCE_PCT}/{@link #PARTIAL_MIN_ABS_EUR}/{@link #PARTIAL_MAX_ABS_EUR}.
     *
     * <p>Si faltan los campos {@code payAmountCrypto} o
     * {@code actuallyPaidCrypto} en el evento (nulls), NO aplicamos
     * tolerancia por precaucion → el pago sigue como FAILED y requiere
     * intervencion manual.
     *
     * <p>Log siempre a WARN con el margen permitido y la decision, para
     * tener visibilidad operativa de cuanto se activa esta tolerancia.
     */
    private boolean isPartialWithinTolerance(PaymentSession session, WebhookEvent event,
                                              String providerKey, String pspTxId) {
        BigDecimal payCrypto = event.getPayAmountCrypto();
        BigDecimal actuallyCrypto = event.getActuallyPaidCrypto();
        if (payCrypto == null || actuallyCrypto == null
                || payCrypto.compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("[PSP-WEBHOOK] partial_paid SIN campos cripto, NO se aplica tolerancia " +
                            "provider={} pspTx={} orderId={} pack={} payCrypto={} actuallyCrypto={}",
                    providerKey, pspTxId, session.getOrderId(), session.getPackId(),
                    payCrypto, actuallyCrypto);
            return false;
        }
        BigDecimal ratio = actuallyCrypto.divide(payCrypto, 6, java.math.RoundingMode.HALF_UP);
        BigDecimal priceEur = session.getAmount();
        BigDecimal diffEur = priceEur
                .multiply(BigDecimal.ONE.subtract(ratio))
                .setScale(2, java.math.RoundingMode.HALF_UP);
        // Margen permitido = max(3% del pack, suelo 0,50€), topado a 5€.
        BigDecimal allowedAbsEur = priceEur.multiply(PARTIAL_TOLERANCE_PCT)
                .max(PARTIAL_MIN_ABS_EUR)
                .min(PARTIAL_MAX_ABS_EUR)
                .setScale(2, java.math.RoundingMode.HALF_UP);
        // Aceptamos si lo que falta en EUR no supera ese margen. diffEur<=0
        // (pago exacto o de mas) tambien entra por este <= y se acredita.
        boolean accept = diffEur.compareTo(allowedAbsEur) <= 0;
        log.warn("[PSP-WEBHOOK] partial_paid analisis tolerancia provider={} pspTx={} orderId={} " +
                        "pack={} priceEur={} payCrypto={} actuallyCrypto={} ratio={} diffEur={} " +
                        "allowedAbsEur={} decision={}",
                providerKey, pspTxId, session.getOrderId(), session.getPackId(),
                priceEur, payCrypto, actuallyCrypto, ratio, diffEur,
                allowedAbsEur, accept ? "ACCEPT_AS_SUCCESS" : "STAY_FAILED");
        return accept;
    }
}
