package com.sharemechat.support.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sharemechat.entity.PaymentSession;
import com.sharemechat.entity.StreamRecord;
import com.sharemechat.entity.StreamStatusEvent;
import com.sharemechat.entity.Transaction;
import com.sharemechat.repository.PaymentSessionRepository;
import com.sharemechat.repository.StreamRecordRepository;
import com.sharemechat.repository.StreamStatusEventRepository;
import com.sharemechat.repository.TransactionRepository;
import com.sharemechat.support.entity.SupportTicket;
import com.sharemechat.support.repository.SupportTicketRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * ADR-054 Fase T1 (D3): verificacion automatica de un ticket contra las
 * fuentes internas segun categoria. Devuelve un JSON estructurado con
 * signals + signalStrength global. La recomendacion es siempre
 * MANUAL_REVIEW en esta primera version (D3 alternativa descartada:
 * auto-approve/auto-reject se difiere a evolucion futura).
 *
 * <p>Categorias soportadas en T1:
 * <ul>
 *   <li>STREAM_INTERRUPTED — contra stream_records + stream_status_events.</li>
 *   <li>PAYMENT_NOT_CREDITED — contra payment_sessions + transactions.</li>
 * </ul>
 * Las otras categorias (MODERATION_FALSE_POSITIVE, ACCOUNT_ISSUE, OTHER)
 * quedan sin verificacion automatica en T1; el endpoint responde con
 * signalStrength=NEUTRAL y una nota indicando "categoria sin checks
 * automaticos, revision manual necesaria".
 *
 * <p>El servicio actualiza en la propia entity los campos
 * {@code verificationLastRunAt}, {@code verificationLastResultJson} y
 * {@code verificationLastSignal} para que el panel admin muestre el
 * ultimo resultado sin re-computar.
 */
@Service
public class TicketVerificationService {

    private static final Logger log = LoggerFactory.getLogger(TicketVerificationService.class);

    // Event types que indican corte anomalo del stream (ver V1__baseline.sql
    // stream_status_events.event_type CHECK).
    private static final List<String> ANOMALOUS_END_EVENTS = List.of(
            "DISCONNECT", "TIMEOUT", "CUT_LOW_BALANCE"
    );

    private final SupportTicketRepository ticketRepo;
    private final StreamRecordRepository streamRecordRepo;
    private final StreamStatusEventRepository streamStatusEventRepo;
    private final PaymentSessionRepository paymentSessionRepo;
    private final TransactionRepository transactionRepo;
    private final ObjectMapper mapper;

    public TicketVerificationService(SupportTicketRepository ticketRepo,
                                     StreamRecordRepository streamRecordRepo,
                                     StreamStatusEventRepository streamStatusEventRepo,
                                     PaymentSessionRepository paymentSessionRepo,
                                     TransactionRepository transactionRepo,
                                     ObjectMapper mapper) {
        this.ticketRepo = ticketRepo;
        this.streamRecordRepo = streamRecordRepo;
        this.streamStatusEventRepo = streamStatusEventRepo;
        this.paymentSessionRepo = paymentSessionRepo;
        this.transactionRepo = transactionRepo;
        this.mapper = mapper;
    }

    /**
     * Ejecuta la verificacion para el ticket dado. Actualiza el propio
     * ticket con el resultado + signal + timestamp y devuelve el JSON
     * como String (formato pretty-friendly para el panel admin).
     */
    @Transactional
    public String verify(Long ticketId) {
        SupportTicket ticket = ticketRepo.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("Ticket no encontrado id=" + ticketId));

        ObjectNode root = mapper.createObjectNode();
        root.put("ticketId", ticket.getId());
        root.put("category", ticket.getCategory());
        root.put("verifiedAt", LocalDateTime.now(ZoneOffset.UTC).toString() + "Z");
        ArrayNode signals = root.putArray("signals");

        String globalSignal;
        switch (ticket.getCategory()) {
            case "STREAM_INTERRUPTED":
                globalSignal = verifyStreamInterrupted(ticket, signals);
                break;
            case "PAYMENT_NOT_CREDITED":
                globalSignal = verifyPaymentNotCredited(ticket, signals);
                break;
            default:
                ObjectNode note = signals.addObject();
                note.put("source", "N/A");
                note.put("note", "categoria " + ticket.getCategory()
                        + " sin checks automaticos en T1, revision manual necesaria");
                note.put("signal", "NEUTRAL");
                globalSignal = "NEUTRAL";
                break;
        }
        root.put("signalStrength", globalSignal);
        root.put("recommendation", "MANUAL_REVIEW");

        String json;
        try {
            json = mapper.writeValueAsString(root);
        } catch (Exception ex) {
            log.error("[TICKET-VERIFY] serialize failed ticketId={}: {}", ticketId, ex.getMessage());
            json = "{\"error\":\"serialize_failed\"}";
        }

        ticket.setVerificationLastRunAt(LocalDateTime.now());
        ticket.setVerificationLastResultJson(json);
        ticket.setVerificationLastSignal(globalSignal);
        ticketRepo.save(ticket);

        log.info("[TICKET-VERIFY] ticketId={} category={} signal={}",
                ticketId, ticket.getCategory(), globalSignal);
        return json;
    }

    // ============================================================
    // STREAM_INTERRUPTED
    // ============================================================
    private String verifyStreamInterrupted(SupportTicket ticket, ArrayNode signals) {
        Long streamId = ticket.getLinkedStreamRecordId();
        if (streamId == null) {
            ObjectNode s = signals.addObject();
            s.put("source", "stream_records");
            s.put("note", "ticket sin linked_stream_record_id, no se puede verificar automaticamente");
            s.put("signal", "NEUTRAL");
            return "NEUTRAL";
        }
        StreamRecord stream = streamRecordRepo.findById(streamId).orElse(null);
        if (stream == null) {
            ObjectNode s = signals.addObject();
            s.put("source", "stream_records");
            s.put("streamRecordId", streamId);
            s.put("note", "stream no encontrado en BD");
            s.put("signal", "NEGATIVE");
            return "NEGATIVE";
        }
        // Ownership: el ticket lo abrio userId, y en STREAM_INTERRUPTED el cliente
        // es quien reclama. Si el user del ticket no coincide con client_id ni
        // model_id del stream, se marca NEGATIVE (posible fraude).
        Long uid = ticket.getUserId();
        boolean userMatches = (stream.getClient() != null && uid.equals(stream.getClient().getId()))
                || (stream.getModel() != null && uid.equals(stream.getModel().getId()));
        if (!userMatches) {
            ObjectNode s = signals.addObject();
            s.put("source", "stream_records");
            s.put("streamRecordId", streamId);
            s.put("note", "user del ticket no coincide con client/model del stream");
            s.put("signal", "NEGATIVE");
            return "NEGATIVE";
        }

        ObjectNode s = signals.addObject();
        s.put("source", "stream_records");
        s.put("streamRecordId", streamId);
        s.put("clientId", stream.getClient() != null ? stream.getClient().getId() : null);
        s.put("modelId", stream.getModel() != null ? stream.getModel().getId() : null);
        s.put("streamType", stream.getStreamType());
        s.put("startTime", asString(stream.getStartTime()));
        s.put("confirmedAt", asString(stream.getConfirmedAt()));
        s.put("billableStart", asString(stream.getBillableStart()));
        s.put("endTime", asString(stream.getEndTime()));
        Long billedSeconds = calcBilledSeconds(stream);
        s.put("billedSeconds", billedSeconds);

        // Eventos anomalos del stream.
        List<StreamStatusEvent> events = streamStatusEventRepo
                .findByStreamRecordIdOrderByCreatedAtDesc(streamId, PageRequest.of(0, 50));
        ArrayNode eventsNode = s.putArray("events");
        boolean hasAnomalousEnd = false;
        for (StreamStatusEvent ev : events) {
            ObjectNode e = eventsNode.addObject();
            e.put("eventType", ev.getEventType());
            e.put("reason", ev.getReason());
            e.put("createdAt", asString(ev.getCreatedAt()));
            if (ANOMALOUS_END_EVENTS.contains(ev.getEventType())) {
                hasAnomalousEnd = true;
            }
        }

        // Heuristica de signal:
        // - STRONG_POSITIVE: hay evento DISCONNECT/TIMEOUT/CUT_LOW_BALANCE.
        // - WEAK_POSITIVE: stream terminado sin evento anomalo pero duracion muy corta (<60s facturados).
        // - NEUTRAL: stream terminado normalmente con duracion decente.
        // - NEGATIVE: stream sin end_time (sigue vivo, no hubo corte).
        String signal;
        if (stream.getEndTime() == null) {
            s.put("signal", "NEGATIVE");
            s.put("signalReason", "stream sin end_time (no hubo corte)");
            signal = "NEGATIVE";
        } else if (hasAnomalousEnd) {
            s.put("signal", "STRONG_POSITIVE");
            s.put("signalReason", "evento de corte anomalo detectado");
            signal = "STRONG_POSITIVE";
        } else if (billedSeconds != null && billedSeconds < 60) {
            s.put("signal", "WEAK_POSITIVE");
            s.put("signalReason", "duracion facturada <60s sin evento anomalo");
            signal = "WEAK_POSITIVE";
        } else {
            s.put("signal", "NEUTRAL");
            s.put("signalReason", "stream terminado normalmente");
            signal = "NEUTRAL";
        }
        return signal;
    }

    // ============================================================
    // PAYMENT_NOT_CREDITED
    // ============================================================
    private String verifyPaymentNotCredited(SupportTicket ticket, ArrayNode signals) {
        Long sessionId = ticket.getLinkedPaymentSessionId();
        if (sessionId == null) {
            ObjectNode s = signals.addObject();
            s.put("source", "payment_sessions");
            s.put("note", "ticket sin linked_payment_session_id, no se puede verificar automaticamente");
            s.put("signal", "NEUTRAL");
            return "NEUTRAL";
        }
        PaymentSession ps = paymentSessionRepo.findById(sessionId).orElse(null);
        if (ps == null) {
            ObjectNode s = signals.addObject();
            s.put("source", "payment_sessions");
            s.put("paymentSessionId", sessionId);
            s.put("note", "payment_session no encontrada en BD");
            s.put("signal", "NEGATIVE");
            return "NEGATIVE";
        }
        Long uid = ticket.getUserId();
        if (ps.getUser() == null || !uid.equals(ps.getUser().getId())) {
            ObjectNode s = signals.addObject();
            s.put("source", "payment_sessions");
            s.put("paymentSessionId", sessionId);
            s.put("note", "user del ticket no coincide con user de la payment_session");
            s.put("signal", "NEGATIVE");
            return "NEGATIVE";
        }

        ObjectNode s = signals.addObject();
        s.put("source", "payment_sessions");
        s.put("paymentSessionId", sessionId);
        s.put("orderId", ps.getOrderId());
        s.put("packId", ps.getPackId());
        s.put("amount", ps.getAmount() != null ? ps.getAmount().toPlainString() : null);
        s.put("currency", ps.getCurrency());
        s.put("status", ps.getStatus());
        s.put("pspTransactionId", ps.getPspTransactionId());
        s.put("createdAt", asString(ps.getCreatedAt()));

        // Heuristica de signal:
        // - STRONG_POSITIVE: payment_session en SUCCESS + NO existe Transaction
        //   INGRESO para este user cuya description contenga orderId.
        // - WEAK_POSITIVE: payment_session en SUCCESS + existe Transaction pero
        //   no matchea el amount (posible drift ADR-053).
        // - NEUTRAL: payment_session terminada en FAILED/EXPIRED (rechazo legitimo).
        // - NEGATIVE: payment_session en SUCCESS + Transaction INGRESO con
        //   description matching orderId y amount matching (todo OK, sin problema).
        if (!"SUCCESS".equals(ps.getStatus())) {
            s.put("signal", "NEUTRAL");
            s.put("signalReason", "payment_session no esta en SUCCESS (status=" + ps.getStatus() + ")");
            return "NEUTRAL";
        }

        // Buscar Transaction del user cuyo description contenga el orderId.
        List<Transaction> userTxs = findRecentUserTransactions(uid, ps.getCreatedAt());
        Transaction match = null;
        for (Transaction tx : userTxs) {
            String desc = tx.getDescription();
            if (desc != null && ps.getOrderId() != null && desc.contains(ps.getOrderId())) {
                match = tx;
                break;
            }
        }
        if (match == null) {
            s.put("signal", "STRONG_POSITIVE");
            s.put("signalReason", "payment SUCCESS pero no hay Transaction con orderId " + ps.getOrderId());
            return "STRONG_POSITIVE";
        }
        s.put("matchedTransactionId", match.getId());
        s.put("matchedTransactionAmount", match.getAmount() != null ? match.getAmount().toPlainString() : null);
        s.put("matchedTransactionType", match.getOperationType());
        if (match.getAmount() == null || ps.getAmount() == null
                || match.getAmount().compareTo(ps.getAmount()) != 0) {
            s.put("signal", "WEAK_POSITIVE");
            s.put("signalReason", "Transaction encontrada pero amount no matchea (posible drift)");
            return "WEAK_POSITIVE";
        }
        s.put("signal", "NEGATIVE");
        s.put("signalReason", "payment credito correctamente al ledger, sin discrepancia");
        return "NEGATIVE";
    }

    /**
     * Devuelve Transactions del usuario en ventana de 30 dias alrededor de la
     * fecha de creacion del payment (mas eficiente que scan completo del user).
     * Sin API dedicada en TransactionRepository, se hace via findAll paginado
     * filtrando en memoria — aceptable para verificacion admin (llamada no
     * frecuente, ventana limitada).
     */
    private List<Transaction> findRecentUserTransactions(Long userId, LocalDateTime aroundInstant) {
        LocalDateTime since = aroundInstant != null
                ? aroundInstant.minusDays(30)
                : LocalDateTime.now().minusDays(30);
        // No hay findByUserAndTimestampAfter directo; usamos findAll+filter con
        // pageSize razonable. Alternativa: aniadir query dedicada al repo si el
        // volumen lo pide. Por ahora, cap 500 tx recientes.
        return transactionRepo.findAll(PageRequest.of(0, 500,
                        org.springframework.data.domain.Sort.by(
                                org.springframework.data.domain.Sort.Direction.DESC, "id")))
                .stream()
                .filter(t -> t.getUser() != null && userId.equals(t.getUser().getId()))
                .filter(t -> t.getTimestamp() == null || !t.getTimestamp().isBefore(since))
                .toList();
    }

    // ============================================================
    // Helpers
    // ============================================================
    private static String asString(LocalDateTime dt) {
        return dt == null ? null : dt.toString();
    }

    private static Long calcBilledSeconds(StreamRecord stream) {
        LocalDateTime from = stream.getBillableStart() != null
                ? stream.getBillableStart()
                : stream.getConfirmedAt() != null ? stream.getConfirmedAt() : stream.getStartTime();
        LocalDateTime to = stream.getEndTime();
        if (from == null || to == null) return null;
        return ChronoUnit.SECONDS.between(from, to);
    }
}
