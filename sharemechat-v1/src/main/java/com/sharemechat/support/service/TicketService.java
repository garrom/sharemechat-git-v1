package com.sharemechat.support.service;

import com.sharemechat.support.entity.SupportConversation;
import com.sharemechat.support.entity.SupportTicket;
import com.sharemechat.support.repository.SupportConversationRepository;
import com.sharemechat.support.repository.SupportTicketRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/**
 * ADR-054 Fase T1. Gestion del ciclo de vida del ticket de incidencia:
 * apertura (D2 b1 formulario explicito), transiciones de estado validas
 * (D6) y anti-fraude estructural (D7: rate limit + flag informativo).
 *
 * <p>NO gestiona la compensacion economica en si — eso vive en
 * {@code TransactionService.manualRefundToClient} extendido con
 * {@code ticketId}. TicketService solo prepara y cierra el ticket alrededor
 * de esa llamada. NO gestiona la verificacion — eso vive en
 * {@link TicketVerificationService}.
 */
@Service
public class TicketService {

    private static final Logger log = LoggerFactory.getLogger(TicketService.class);

    // Categorias validas (D2 b1). Enum-checked tambien en BD via CHECK constraint V41.
    public static final Set<String> VALID_CATEGORIES = Set.of(
            "STREAM_INTERRUPTED",
            "PAYMENT_NOT_CREDITED",
            "MODERATION_FALSE_POSITIVE",
            "ACCOUNT_ISSUE",
            "OTHER"
    );

    // Estados no terminales (D6). El resto son terminales.
    public static final Set<String> OPEN_STATUSES = Set.of(
            "OPEN",
            "INVESTIGATING",
            "RESOLVED_COMPENSATED_PENDING_CREDIT"
    );

    // D7 anti-fraude: limites.
    // 2026-08-07: subido de 2 a 5 tickets abiertos simultáneos por feedback UX.
    // 2 era demasiado restrictivo — un user con dos incidencias legítimas (p.ej.
    // corte de streaming + pago no acreditado) topaba el límite sin poder
    // reportar otras nuevas mientras las anteriores seguían en investigación.
    // 5 sigue siendo defensa razonable contra abuso masivo (spam creando
    // decenas). El ceiling absoluto de 30 días (MAX_TICKETS_PER_30D=5) sigue
    // gobernando el volumen total en la ventana rolling.
    public static final int MAX_OPEN_TICKETS_PER_USER = 5;
    public static final int MAX_TICKETS_PER_30D = 5;
    public static final int HIGH_HISTORY_COMPENSATED_THRESHOLD = 3;
    public static final int HIGH_HISTORY_WINDOW_DAYS = 90;

    private final SupportTicketRepository ticketRepo;
    private final SupportConversationRepository conversationRepo;

    public TicketService(SupportTicketRepository ticketRepo,
                         SupportConversationRepository conversationRepo) {
        this.ticketRepo = ticketRepo;
        this.conversationRepo = conversationRepo;
    }

    /**
     * D2 b1: crea un ticket a partir del formulario explicito del cliente.
     * Aplica rate limits D7. Crea automaticamente una SupportConversation
     * asociada en estado HUMAN_HANDLING (D8) para el canal de comunicacion.
     *
     * @throws IllegalArgumentException si la categoria es invalida o falta descripcion.
     * @throws RateLimitExceededException si el user supera limites D7.
     */
    @Transactional
    public SupportTicket openTicket(Long userId,
                                    String category,
                                    String description,
                                    LocalDateTime reportedIncidentAt,
                                    Long linkedStreamRecordId,
                                    Long linkedPaymentSessionId) {
        return openTicket(userId, category, description, reportedIncidentAt,
                linkedStreamRecordId, linkedPaymentSessionId, null);
    }

    /**
     * ADR-054 Fase T3: overload que acepta {@code existingConversationId}
     * opcional. Cuando el ticket nace desde el chat bot (D2 b2, oferta con
     * confirmacion del usuario) reutilizamos la SupportConversation en la
     * que ya estabamos hablando en vez de crear una nueva — evita
     * conversaciones huerfanas y el user ve el ticket con el hilo continuo
     * en la misma UI de chat. Si {@code existingConversationId} es null,
     * comportamiento identico a {@link #openTicket(Long, String, String,
     * LocalDateTime, Long, Long)}.
     */
    @Transactional
    public SupportTicket openTicket(Long userId,
                                    String category,
                                    String description,
                                    LocalDateTime reportedIncidentAt,
                                    Long linkedStreamRecordId,
                                    Long linkedPaymentSessionId,
                                    Long existingConversationId) {
        if (userId == null || userId <= 0) {
            throw new IllegalArgumentException("userId invalido");
        }
        if (category == null || !VALID_CATEGORIES.contains(category)) {
            throw new IllegalArgumentException("category invalida: " + category);
        }
        if (description == null || description.trim().isEmpty()) {
            throw new IllegalArgumentException("description obligatoria");
        }

        long openCount = ticketRepo.countByUserIdAndStatusIn(userId, OPEN_STATUSES);
        if (openCount >= MAX_OPEN_TICKETS_PER_USER) {
            throw new RateLimitExceededException(
                    "Ya tienes " + openCount + " tickets abiertos. Maximo " +
                    MAX_OPEN_TICKETS_PER_USER + " simultaneos.");
        }
        LocalDateTime since30d = LocalDateTime.now().minusDays(30);
        long recent30dCount = ticketRepo.countByUserIdAndCreatedAtGreaterThanEqual(userId, since30d);
        if (recent30dCount >= MAX_TICKETS_PER_30D) {
            throw new RateLimitExceededException(
                    "Has creado " + recent30dCount + " tickets en los ultimos 30 dias. Maximo " +
                    MAX_TICKETS_PER_30D + ".");
        }

        // D7 flag informativo (no bloqueante).
        LocalDateTime since90d = LocalDateTime.now().minusDays(HIGH_HISTORY_WINDOW_DAYS);
        long compensatedCount = ticketRepo.countByUserIdAndStatusAndResolvedAtGreaterThanEqual(
                userId, "RESOLVED_COMPENSATED", since90d);
        boolean highHistory = compensatedCount >= HIGH_HISTORY_COMPENSATED_THRESHOLD;

        // D8: conversacion asociada. Si nos pasan una existente (chat bot ->
        // ticket via oferta confirmada), la reutilizamos cambiando su status
        // a HUMAN_HANDLING; si no, creamos una nueva.
        SupportConversation conv;
        if (existingConversationId != null) {
            conv = conversationRepo.findById(existingConversationId)
                    .orElseThrow(() -> new IllegalArgumentException(
                            "existingConversationId no encontrada=" + existingConversationId));
            if (!userId.equals(conv.getUserId())) {
                throw new IllegalArgumentException(
                        "existingConversation " + existingConversationId +
                        " no pertenece al userId=" + userId);
            }
            conv.setResolutionStatus("HUMAN_HANDLING");
            conv.setUpdatedAt(LocalDateTime.now());
            conv = conversationRepo.save(conv);
        } else {
            conv = new SupportConversation();
            conv.setUserId(userId);
            conv.setResolutionStatus("HUMAN_HANDLING");
            conv.setEscalationReason("TICKET auto-created channel (category=" + category + ")");
            conv = conversationRepo.save(conv);
        }

        SupportTicket ticket = new SupportTicket();
        ticket.setUserId(userId);
        ticket.setCategory(category);
        ticket.setStatus("OPEN");
        ticket.setDescription(description.trim());
        ticket.setReportedIncidentAt(reportedIncidentAt);
        ticket.setLinkedConversationId(conv.getId());
        ticket.setLinkedStreamRecordId(linkedStreamRecordId);
        ticket.setLinkedPaymentSessionId(linkedPaymentSessionId);
        ticket.setHighHistoryFlag(highHistory);
        SupportTicket saved = ticketRepo.save(ticket);

        log.info("[TICKET] opened id={} userId={} category={} convId={} reused={} highHistory={}",
                saved.getId(), userId, category, conv.getId(), existingConversationId != null, highHistory);
        return saved;
    }

    /**
     * D6: transiciones de estado validas. Cualquier otra transicion lanza
     * {@link IllegalStateException}. NO ejecuta side effects (no acredita
     * dinero, no notifica) — solo cambia el status con validacion.
     *
     * <p>Excepcion: OPEN -> RESOLVED_COMPENSATED_PENDING_CREDIT NO es transicion
     * valida directa. Requiere pasar por INVESTIGATING (el agente humano debe
     * al menos verificar antes de decidir compensar).
     */
    @Transactional
    public SupportTicket transitionStatus(Long ticketId, String newStatus,
                                          Long adminId, String notes) {
        SupportTicket t = ticketRepo.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("ticket no encontrado id=" + ticketId));
        String current = t.getStatus();
        if (!isValidTransition(current, newStatus)) {
            throw new IllegalStateException("Transicion invalida " + current + " -> " + newStatus);
        }
        t.setStatus(newStatus);
        if (notes != null && !notes.trim().isEmpty()) {
            t.setResolutionNotes(notes.trim());
        }
        // resolvedAt/resolvedByAdminId se marcan en estados terminales de resolucion
        // (no en ABANDONED que es cierre no gestionado).
        if ("RESOLVED_COMPENSATED".equals(newStatus)
                || "RESOLVED_NO_COMPENSATION".equals(newStatus)
                || "REJECTED_INVALID".equals(newStatus)) {
            t.setResolvedAt(LocalDateTime.now());
            t.setResolvedByAdminId(adminId);
        }
        SupportTicket saved = ticketRepo.save(t);
        log.info("[TICKET] status id={} {} -> {} by adminId={}", ticketId, current, newStatus, adminId);
        return saved;
    }

    /**
     * Reglas D6 de transicion. Publico para reuso en tests y en el
     * {@code TransactionService} extendido (D4) que necesita validar
     * el estado RESOLVED_COMPENSATED_PENDING_CREDIT antes de acreditar.
     */
    public static boolean isValidTransition(String from, String to) {
        if (from == null || to == null) return false;
        switch (from) {
            case "OPEN":
                return "INVESTIGATING".equals(to) || "REJECTED_INVALID".equals(to);
            case "INVESTIGATING":
                return "RESOLVED_COMPENSATED_PENDING_CREDIT".equals(to)
                        || "RESOLVED_NO_COMPENSATION".equals(to)
                        || "ABANDONED".equals(to);
            case "RESOLVED_COMPENSATED_PENDING_CREDIT":
                return "RESOLVED_COMPENSATED".equals(to);
            default:
                // Estados terminales (RESOLVED_COMPENSATED, RESOLVED_NO_COMPENSATION,
                // REJECTED_INVALID, ABANDONED) no admiten mas transiciones.
                return false;
        }
    }

    // ============================================================
    // Consultas simples.
    // ============================================================

    public List<SupportTicket> listByUser(Long userId) {
        return ticketRepo.findAllByUserIdOrderByIdDesc(userId);
    }

    public SupportTicket findByIdForUser(Long ticketId, Long userId) {
        return ticketRepo.findByIdAndUserId(ticketId, userId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Ticket no encontrado id=" + ticketId + " userId=" + userId));
    }

    public SupportTicket findByIdOrThrow(Long ticketId) {
        return ticketRepo.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("Ticket no encontrado id=" + ticketId));
    }

    // ============================================================
    // Exception dedicada para que el controller la mapee a HTTP 429.
    // ============================================================

    public static class RateLimitExceededException extends RuntimeException {
        public RateLimitExceededException(String msg) { super(msg); }
    }
}
