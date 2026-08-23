package com.sharemechat.support.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.support.config.ClaudeApiProperties;
import com.sharemechat.support.dto.ClaudeApiResponse;
import com.sharemechat.support.dto.SupportConversationMetaDTO;
import com.sharemechat.support.dto.SupportMessageDTO;
import com.sharemechat.support.dto.SupportMessageResponseDTO;
import com.sharemechat.support.entity.SupportConversation;
import com.sharemechat.support.entity.SupportMessage;
import com.sharemechat.support.repository.BackofficeAgentProfileRepository;
import com.sharemechat.support.repository.SupportConversationRepository;
import com.sharemechat.support.repository.SupportMessageRepository;
import com.sharemechat.support.repository.SupportTicketRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Orquestador del chat soporte (DEC-CS-1..18).
 *
 * <ol>
 *   <li>Localiza o crea la conversacion activa del usuario (OPEN, ESCALATED,
 *       HUMAN_HANDLING o RATE_LIMITED). Solo RESOLVED y ABANDONED disparan
 *       conversacion nueva.</li>
 *   <li>Persiste el mensaje del usuario.</li>
 *   <li><b>Frente B.3.1 (ADR-046):</b> guard humano temprano. Si la conv tiene
 *       {@code assigned_agent_id != null}, el bot no llama al LLM ni cuenta
 *       tokens de rate-limit. El DTO devuelto marca {@code humanHandling=true}
 *       y el frontend cliente renderiza "esperando respuesta del equipo".</li>
 *   <li>Consulta rate limit. Si excedido, marca conversacion RATE_LIMITED,
 *       responde con mensaje canonico, NO llama Claude (DEC-CS-11).</li>
 *   <li>Construye system prompt = base fija + KB + contexto usuario minimo
 *       (email/role/verification_status; DEC-CS-6).</li>
 *   <li>Envia ultimos N=10 mensajes de la conversacion + mensaje actual
 *       al ClaudeApiClient (DEC-CS-14).</li>
 *   <li><b>Frente B.3.1 (ADR-046):</b> race check post-LLM via
 *       {@code touchIfStillUnassigned}. Si un admin hizo claim durante la
 *       llamada Claude, se descarta la respuesta LLM (no se persiste ni se
 *       cobra rate-limit; los tokens API consumidos se pierden como coste
 *       asumido del race).</li>
 *   <li>Persiste respuesta LLM. Actualiza contador tokens.</li>
 *   <li>Si el LLM invoco escalate_to_human tool, marca conversacion
 *       ESCALATED con reason (DEC-CS-2, escalado automatico).</li>
 * </ol>
 */
@Service
public class SupportBotService {

    /**
     * Estados en los que una conversacion sigue viva para el mismo user. Fuera
     * de esta lista (RESOLVED, ABANDONED) el proximo mensaje abre conv nueva.
     */
    static final Set<String> ACTIVE_STATUSES = Set.of(
            Constants.SupportResolutionStatuses.OPEN,
            Constants.SupportResolutionStatuses.ESCALATED,
            Constants.SupportResolutionStatuses.HUMAN_HANDLING,
            Constants.SupportResolutionStatuses.RATE_LIMITED
    );

    private static final Logger log = LoggerFactory.getLogger(SupportBotService.class);

    static final String RATE_LIMIT_MESSAGE_ES =
            "El agente IA no esta disponible ahora. Revisaremos tu conversacion pronto.";
    static final String LLM_UNAVAILABLE_MESSAGE_ES =
            "El agente IA no esta disponible temporalmente. Un miembro del equipo revisara tu mensaje.";
    static final String ESCALATION_MESSAGE_ES =
            "Te derivamos con un miembro del equipo humano; revisara tu caso y te contactara.";
    static final String ESCALATED_WAITING_MESSAGE_ES =
            "Tu caso ya esta con el equipo humano; lo revisaran en cuanto puedan. "
            + "Si surge algo nuevo, abrelo como incidencia desde el icono de ticket del navbar.";

    static final int MAX_USER_MESSAGE_LENGTH = 4000;

    private final SupportConversationRepository conversationRepo;
    private final SupportMessageRepository messageRepo;
    private final SupportRateLimitService rateLimitService;
    private final KnowledgeBaseService kbService;
    private final SupportBotRouterService router;
    private final ClaudeApiClient claudeClient;
    private final ClaudeApiProperties props;
    private final UserRepository userRepository;

    // ADR-054 D8 (2026-08-06): meta de conversacion para pintar badge dinamico
    // en el cliente (Agente IA vs Tecnico asignado). Se resuelve el display
    // name del perfil asignado desde este repo.
    private final BackofficeAgentProfileRepository profileRepo;

    // ADR-054 D8 refinement (2026-08-07): repositorio de tickets consultado
    // desde getOrCreateActiveConversation para SALTAR convs ticket-bound y
    // devolver siempre la conv casual "activa" del user (canales separados).
    // Antes tambien silenciaba el bot en convs ticket-bound + T3 hook ofrecia
    // abrir ticket desde el chat, ambos eliminados con este refinement:
    // canales completamente separados, el bot NUNCA interactua con la conv
    // de un ticket, y el usuario abre tickets explicitamente desde tab
    // "Mis incidencias".
    private final SupportTicketRepository ticketRepository;

    public SupportBotService(SupportConversationRepository conversationRepo,
                              SupportMessageRepository messageRepo,
                              SupportRateLimitService rateLimitService,
                              KnowledgeBaseService kbService,
                              SupportBotRouterService router,
                              ClaudeApiClient claudeClient,
                              ClaudeApiProperties props,
                              UserRepository userRepository,
                              BackofficeAgentProfileRepository profileRepo,
                              SupportTicketRepository ticketRepository) {
        this.conversationRepo = conversationRepo;
        this.messageRepo = messageRepo;
        this.rateLimitService = rateLimitService;
        this.kbService = kbService;
        this.router = router;
        this.claudeClient = claudeClient;
        this.props = props;
        this.userRepository = userRepository;
        this.profileRepo = profileRepo;
        this.ticketRepository = ticketRepository;
    }

    @Transactional
    public SupportMessageResponseDTO handleUserMessage(Long userId, String rawMessage, String clientIp) {
        if (userId == null) throw new IllegalArgumentException("userId requerido");
        String message = rawMessage == null ? "" : rawMessage.trim();
        if (message.isEmpty()) throw new IllegalArgumentException("message vacio");
        if (message.length() > MAX_USER_MESSAGE_LENGTH) {
            throw new IllegalArgumentException("message demasiado largo (>" + MAX_USER_MESSAGE_LENGTH + ")");
        }

        SupportConversation conv = getOrCreateActiveConversation(userId);
        persistMessage(conv.getId(), Constants.SupportSenderTypes.USER, message, null, null, null, null, null);

        SupportMessageResponseDTO out = new SupportMessageResponseDTO();
        out.setConversationId(conv.getId());
        out.setTimestamp(LocalDateTime.now());

        // Frente B.3.1 (ADR-046): guard humano temprano. Si hay claim activo,
        // el bot no llama al LLM ni consume rate-limit. Requisito del brief
        // "rate-limit no cuenta en HUMAN_HANDLING" cumplido por reorden.
        if (conv.getAssignedAgentId() != null) {
            log.info("[SUPPORT-BOT] skip LLM userId={} conversationId={} assignedAgentId={} (human handling)",
                    userId, conv.getId(), conv.getAssignedAgentId());
            out.setReply(null);
            out.setResolutionStatus(Constants.SupportResolutionStatuses.HUMAN_HANDLING);
            out.setHumanHandling(true);
            out.setEscalated(false);
            out.setMessagesRemainingToday(rateLimitService.remainingMessages(userId));
            out.setTokensRemainingToday(rateLimitService.remainingTokens(userId));
            return out;
        }

        // Una vez ESCALADA, el bot NO vuelve a atender (incidente 2026-08-23: el
        // bot seguia respondiendo tras escalar -> incongruencia y sin trazabilidad
        // limpia IA/humano). Regla: o IA o humano, nunca ambos. El mensaje del
        // usuario ya se persistio arriba (queda para el humano); aqui solo se
        // devuelve un aviso de espera, sin llamar al LLM ni consumir tokens. El
        // caso "agente ya asignado" lo cubre el guard anterior.
        if (Constants.SupportResolutionStatuses.ESCALATED.equals(conv.getResolutionStatus())) {
            log.info("[SUPPORT-BOT] skip LLM userId={} conversationId={} (escalated, waiting human)",
                    userId, conv.getId());
            out.setReply(ESCALATED_WAITING_MESSAGE_ES);
            out.setResolutionStatus(Constants.SupportResolutionStatuses.ESCALATED);
            out.setEscalated(true);
            out.setHumanHandling(false);
            out.setMessagesRemainingToday(rateLimitService.remainingMessages(userId));
            out.setTokensRemainingToday(rateLimitService.remainingTokens(userId));
            return out;
        }

        // ADR-054 D8 refinement (2026-08-07): guard "ticket-bound skip LLM" y
        // hook T3 (oferta+confirmación de ticket desde el chat) ELIMINADOS. Con
        // la nueva arquitectura "canales separados", las convs ticket-bound
        // NO llegan a este punto — el getOrCreateActiveConversation las salta
        // y devuelve/crea una conv casual limpia. El bot opera SIEMPRE en su
        // conv casual y para "abrir ticket" el rol del bot pasa a ser textual
        // (guía al user al botón de Incidencias vía system prompt). Elimina
        // el riesgo de cruce accidental entre canales y simplifica el flow.

        // 3) rate limit check
        if (rateLimitService.shouldRateLimit(userId)) {
            conv.setResolutionStatus(Constants.SupportResolutionStatuses.RATE_LIMITED);
            conv.setUpdatedAt(LocalDateTime.now());
            conversationRepo.save(conv);
            persistMessage(conv.getId(), Constants.SupportSenderTypes.SYSTEM, RATE_LIMIT_MESSAGE_ES,
                    null, null, null, null, null);
            out.setReply(RATE_LIMIT_MESSAGE_ES);
            out.setResolutionStatus(Constants.SupportResolutionStatuses.RATE_LIMITED);
            out.setRateLimited(true);
            out.setMessagesRemainingToday(0);
            out.setTokensRemainingToday(0L);
            return out;
        }

        // 4) LLM call
        try {
            String systemPrompt = buildSystemPrompt(userId, message);
            List<ClaudeApiClient.HistoryMessage> history = loadHistoryForLlm(conv.getId());
            ClaudeApiResponse resp = claudeClient.callMessages(systemPrompt, history, message);

            long cost = claudeClient.estimateCostMicros(resp.getTokensInput(), resp.getTokensOutput());
            String replyText = resp.getTextContent();
            String finishReason = resp.getFinishReason();

            // Frente B.3.1 (ADR-046): race check final. Si durante la llamada
            // Claude (5-8s) un admin hizo claim, touchIfStillUnassigned devuelve
            // 0 y descartamos la respuesta: no persistimos, no cobramos tokens.
            // Los tokens API ya consumidos se asumen como coste del race.
            int stillUnassigned = conversationRepo.touchIfStillUnassigned(
                    conv.getId(), LocalDateTime.now());
            if (stillUnassigned == 0) {
                log.info("[SUPPORT-BOT] race lost claim during LLM call, discarding reply " +
                                "userId={} conversationId={} tokens_in={} tokens_out={}",
                        userId, conv.getId(), resp.getTokensInput(), resp.getTokensOutput());
                out.setReply(null);
                out.setResolutionStatus(Constants.SupportResolutionStatuses.HUMAN_HANDLING);
                out.setHumanHandling(true);
                out.setEscalated(false);
                out.setMessagesRemainingToday(rateLimitService.remainingMessages(userId));
                out.setTokensRemainingToday(rateLimitService.remainingTokens(userId));
                return out;
            }

            // 6) persistir LLM message
            SupportMessage llmMsg = persistMessage(conv.getId(), Constants.SupportSenderTypes.LLM,
                    replyText == null ? "" : replyText,
                    resp.getTokensInput(), resp.getTokensOutput(), cost,
                    resp.getModelId(), finishReason);

            int tokensUsed = resp.getTokensInput() + resp.getTokensOutput();
            rateLimitService.registerUsage(userId, tokensUsed);

            // 7) escalado automatico via tool
            if (resp.isEscalationToolCalled()) {
                conv.setResolutionStatus(Constants.SupportResolutionStatuses.ESCALATED);
                conv.setEscalatedAt(LocalDateTime.now());
                conv.setEscalatedByLlm(true);
                conv.setEscalationReason(resp.getEscalationReason());
                conv.setUpdatedAt(LocalDateTime.now());
                conversationRepo.save(conv);

                out.setReply(replyText == null || replyText.isBlank() ? ESCALATION_MESSAGE_ES : replyText);
                out.setResolutionStatus(Constants.SupportResolutionStatuses.ESCALATED);
                out.setEscalated(true);
                out.setEscalationReason(resp.getEscalationReason());
            } else {
                out.setReply(replyText);
                out.setResolutionStatus(conv.getResolutionStatus());
                out.setEscalated(false);
            }
            out.setMessageId(llmMsg.getId());
            out.setMessagesRemainingToday(rateLimitService.remainingMessages(userId));
            out.setTokensRemainingToday(rateLimitService.remainingTokens(userId));
            log.info("[SUPPORT-BOT] reply userId={} conversationId={} tokens_in={} tokens_out={} cost_micros={}",
                    userId, conv.getId(), resp.getTokensInput(), resp.getTokensOutput(), cost);
            return out;
        } catch (Exception ex) {
            log.warn("[SUPPORT-BOT] LLM call failure userId={} conversationId={}: {}",
                    userId, conv.getId(), ex.getMessage());
            persistMessage(conv.getId(), Constants.SupportSenderTypes.SYSTEM, LLM_UNAVAILABLE_MESSAGE_ES,
                    null, null, null, null, null);
            out.setReply(LLM_UNAVAILABLE_MESSAGE_ES);
            out.setResolutionStatus(conv.getResolutionStatus());
            out.setMessagesRemainingToday(rateLimitService.remainingMessages(userId));
            out.setTokensRemainingToday(rateLimitService.remainingTokens(userId));
            return out;
        }
    }

    /**
     * Devuelve el historial completo de mensajes de una conversacion, solo si
     * pertenece al userId indicado. Ordenado por id ascendente.
     *
     * <p>Guard: si la conversacion no existe o no pertenece al user, lanza
     * IllegalArgumentException (traducido a 400 por GlobalExceptionHandler).
     * Se prefiere respuesta uniforme sin distinguir "no existe" de "no es tuya"
     * para no filtrar oraculo de conversation ids.
     */
    @Transactional(readOnly = true)
    public List<SupportMessageDTO> getConversationHistory(Long userId, Long conversationId) {
        if (userId == null) throw new IllegalArgumentException("userId requerido");
        if (conversationId == null) throw new IllegalArgumentException("conversationId requerido");
        SupportConversation conv = conversationRepo.findById(conversationId)
                .orElseThrow(() -> new IllegalArgumentException("Conversacion no encontrada"));
        if (!userId.equals(conv.getUserId())) {
            throw new IllegalArgumentException("Conversacion no encontrada");
        }
        List<SupportMessage> rows = messageRepo.findByConversationIdOrderByIdAsc(conversationId);
        List<SupportMessageDTO> out = new ArrayList<>(rows.size());
        for (SupportMessage m : rows) {
            out.add(new SupportMessageDTO(
                    m.getId(),
                    m.getConversationId(),
                    m.getSender(),
                    m.getContent(),
                    m.getCreatedAt()
            ));
        }
        return out;
    }

    /**
     * ADR-054 D8 Fase F (2026-08-07): mensaje del user directo a la conv del
     * ticket, SIN pasar por el bot LLM. Escribe scoped a `conversationId`
     * (no a "la conv activa" del user), valida ownership y que la conv esté
     * ticket-bound (defensa — el uso legitimo viene desde la vista del
     * ticket). Persist USER + SYSTEM de acuse. No consume rate-limit.
     *
     * Contraparte de handleUserMessage: aquel es para el chat casual con
     * bot, este es para el ticket sin bot. Endpoints separados por diseño
     * (ver SupportController).
     */
    @Transactional
    public SupportMessageResponseDTO handleTicketMessage(Long userId, Long conversationId, String rawMessage) {
        if (userId == null) throw new IllegalArgumentException("userId requerido");
        if (conversationId == null) throw new IllegalArgumentException("conversationId requerido");
        String message = rawMessage == null ? "" : rawMessage.trim();
        if (message.isEmpty()) throw new IllegalArgumentException("message vacio");
        if (message.length() > MAX_USER_MESSAGE_LENGTH) {
            throw new IllegalArgumentException("message demasiado largo (>" + MAX_USER_MESSAGE_LENGTH + ")");
        }

        SupportConversation conv = conversationRepo.findById(conversationId)
                .orElseThrow(() -> new IllegalArgumentException("Conversacion no encontrada"));
        if (!userId.equals(conv.getUserId())) {
            throw new IllegalArgumentException("Conversacion no encontrada");
        }
        // Defensa: el endpoint scoped es SOLO para convs de ticket. Un cliente
        // malicioso desde DevTools podria intentar POSTear a la conv casual
        // por este endpoint para evitar el bot; el guard lo previene.
        if (ticketRepository == null || !ticketRepository.existsByLinkedConversationId(conversationId)) {
            throw new IllegalArgumentException("Conversacion no vinculada a ticket");
        }

        persistMessage(conversationId, Constants.SupportSenderTypes.USER, message,
                null, null, null, null, null);

        String ack = "Recibido. Un tecnico del equipo revisara tu ticket lo antes posible.";
        SupportMessage sysMsg = persistMessage(conversationId, Constants.SupportSenderTypes.SYSTEM, ack,
                null, null, null, null, null);

        conv.setUpdatedAt(LocalDateTime.now());
        conversationRepo.save(conv);

        SupportMessageResponseDTO out = new SupportMessageResponseDTO();
        out.setConversationId(conversationId);
        out.setMessageId(sysMsg.getId());
        out.setReply(ack);
        out.setResolutionStatus(conv.getResolutionStatus());
        out.setHumanHandling(false);
        out.setEscalated(false);
        out.setRateLimited(false);
        out.setMessagesRemainingToday(rateLimitService.remainingMessages(userId));
        out.setTokensRemainingToday(rateLimitService.remainingTokens(userId));
        out.setTimestamp(LocalDateTime.now());
        return out;
    }

    /**
     * Devuelve la meta ligera de una conversacion propiedad del usuario
     * (ADR-054 D8 — cliente, para pintar badge y decidir read-only sin
     * exponer campos internos como assignedAgentId o assignedProfileId).
     *
     * Valida ownership igual que {@link #getConversationHistory}:
     * respuesta uniforme "no encontrada" para no filtrar oraculo de ids.
     */
    @Transactional(readOnly = true)
    public SupportConversationMetaDTO getConversationMeta(Long userId, Long conversationId) {
        if (userId == null) throw new IllegalArgumentException("userId requerido");
        if (conversationId == null) throw new IllegalArgumentException("conversationId requerido");
        SupportConversation conv = conversationRepo.findById(conversationId)
                .orElseThrow(() -> new IllegalArgumentException("Conversacion no encontrada"));
        if (!userId.equals(conv.getUserId())) {
            throw new IllegalArgumentException("Conversacion no encontrada");
        }
        SupportConversationMetaDTO out = new SupportConversationMetaDTO();
        out.setId(conv.getId());
        out.setResolutionStatus(conv.getResolutionStatus());
        boolean human = conv.getAssignedAgentId() != null;
        out.setAssignedToHuman(human);
        if (human && conv.getAssignedProfileId() != null) {
            profileRepo.findById(conv.getAssignedProfileId())
                    .ifPresent(p -> out.setAssignedProfileDisplayName(p.getDisplayName()));
        }
        return out;
    }

    @Transactional
    public SupportConversation escalateManual(Long userId, String reason) {
        SupportConversation conv = getOrCreateActiveConversation(userId);
        conv.setResolutionStatus(Constants.SupportResolutionStatuses.ESCALATED);
        conv.setEscalatedAt(LocalDateTime.now());
        conv.setEscalatedByLlm(false);
        conv.setEscalationReason(reason == null ? "user_request" : safeTrim(reason, 500));
        conv.setUpdatedAt(LocalDateTime.now());
        conversationRepo.save(conv);
        persistMessage(conv.getId(), Constants.SupportSenderTypes.SYSTEM,
                "Usuario solicito hablar con humano. Motivo: " + conv.getEscalationReason(),
                null, null, null, null, null);
        log.info("[SUPPORT-BOT] manual escalate userId={} conversationId={} reason={}",
                userId, conv.getId(), conv.getEscalationReason());
        return conv;
    }

    /**
     * Devuelve la conversacion activa mas reciente del user, o crea una OPEN
     * si no hay ninguna en estado activo. "Activa" incluye OPEN, ESCALATED,
     * HUMAN_HANDLING y RATE_LIMITED (ver {@link #ACTIVE_STATUSES}). Solo
     * RESOLVED y ABANDONED disparan una conversacion nueva. Requisito del
     * frente B.3.1 (ADR-046) para no romper la conv escalada bajo claim humano
     * cuando el user envia otro mensaje.
     */
    private SupportConversation getOrCreateActiveConversation(Long userId) {
        // ADR-054 D8 refinement (2026-08-07): el chat casual con IA y los
        // tickets son CANALES SEPARADOS. Al buscar la conv "activa" del user
        // para el chat casual, saltamos las convs ticket-bound (esas viven
        // solo dentro de su ticket). Si no hay ninguna casual disponible,
        // creamos una nueva OPEN. Retrocompat: el 99% del tiempo el user
        // tiene 0-1 convs activas, así que el bucle es de longitud 0-N con
        // N muy pequeño.
        List<SupportConversation> candidates = conversationRepo
                .findByUserIdAndResolutionStatusInOrderByIdDesc(userId, ACTIVE_STATUSES);
        for (SupportConversation candidate : candidates) {
            if (ticketRepository == null
                    || !ticketRepository.existsByLinkedConversationId(candidate.getId())) {
                return candidate;
            }
        }
        SupportConversation nu = new SupportConversation();
        nu.setUserId(userId);
        nu.setResolutionStatus(Constants.SupportResolutionStatuses.OPEN);
        return conversationRepo.save(nu);
    }

    private SupportMessage persistMessage(Long conversationId, String sender, String content,
                                           Integer tokensIn, Integer tokensOut, Long costMicros,
                                           String model, String finishReason) {
        SupportMessage m = new SupportMessage();
        m.setConversationId(conversationId);
        m.setSender(sender);
        m.setContent(safeTrim(content, 4000));
        m.setTokensInput(tokensIn);
        m.setTokensOutput(tokensOut);
        m.setCostEstimateMicros(costMicros);
        m.setLlmModel(model);
        m.setLlmFinishReason(finishReason);
        return messageRepo.save(m);
    }

    /**
     * Construcción del system prompt (Fase 1.C, ADR-044).
     *
     * <p>Concatena en orden:
     * <ol>
     *   <li>Constitución transversal ({@code comportamiento-agente-ia}).</li>
     *   <li>Mapa de UI transversal ({@code ui-reference}).</li>
     *   <li>Contexto del usuario (email, role, verification_status).</li>
     *   <li>Prompt específico del caso, resuelto por
     *       {@link SupportBotRouterService#route(User, String)}.</li>
     * </ol>
     *
     * <p>Si {@link KnowledgeBaseService#getPromptContent(String)} devuelve
     * {@code Optional.empty()} para alguna clave, se loguea WARN y se sigue
     * con string vacío para esa sección. Sin fallback hardcoded: el operador
     * verá el WARN en TEST y ejecutará {@code /reload} o
     * {@code /seed-from-jar} según corresponda.</p>
     */
    private String buildSystemPrompt(Long userId, String userMessage) {
        StringBuilder sb = new StringBuilder();

        // 1) Constitución transversal — siempre incluida.
        appendCase(sb, "comportamiento-agente-ia");

        // 2) Mapa de UI transversal — siempre incluido.
        appendCase(sb, "ui-reference");

        // 3) Contexto de usuario (DEC-CS-6).
        User u = userRepository.findById(userId).orElse(null);
        if (u != null) {
            sb.append("User context:\n");
            sb.append("- email: ").append(u.getEmail()).append('\n');
            sb.append("- role: ").append(u.getRole()).append('\n');
            if (u.getVerificationStatus() != null) {
                sb.append("- verification_status: ").append(u.getVerificationStatus()).append('\n');
            }
            sb.append('\n');
        }

        // 4) Prompt específico del caso, según el router determinístico.
        String caseKey = router.route(u, userMessage);
        appendCase(sb, caseKey);

        return sb.toString();
    }

    private void appendCase(StringBuilder sb, String caseKey) {
        Optional<String> content = kbService.getPromptContent(caseKey);
        if (content.isPresent()) {
            sb.append(content.get()).append("\n\n");
        } else {
            log.warn("[SUPPORT-BOT] KB missing prompt: case_key={}", caseKey);
        }
    }

    private List<ClaudeApiClient.HistoryMessage> loadHistoryForLlm(Long conversationId) {
        int windowSize = Math.max(1, props.getHistoryMessagesWindow());
        List<SupportMessage> tail = messageRepo.findByConversationIdOrderByIdDesc(
                conversationId, PageRequest.of(0, windowSize));
        Collections.reverse(tail);
        List<ClaudeApiClient.HistoryMessage> out = new ArrayList<>();
        for (SupportMessage m : tail) {
            String role;
            switch (m.getSender()) {
                case "USER":
                    role = "user";
                    break;
                case "LLM":
                    role = "assistant";
                    break;
                default:
                    continue;
            }
            out.add(new ClaudeApiClient.HistoryMessage(role, m.getContent()));
        }
        // Excluir el mensaje que se acaba de guardar (viene como user actual)
        if (!out.isEmpty() && "user".equals(out.get(out.size() - 1).role)) {
            out.remove(out.size() - 1);
        }
        return out;
    }

    private static String safeTrim(String s, int max) {
        if (s == null) return null;
        return s.length() > max ? s.substring(0, max) : s;
    }
}
