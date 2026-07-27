package com.sharemechat.support.service;

import com.sharemechat.repository.UserRepository;
import com.sharemechat.support.config.ClaudeApiProperties;
import com.sharemechat.support.dto.SupportMessageResponseDTO;
import com.sharemechat.support.entity.SupportConversation;
import com.sharemechat.support.entity.SupportMessage;
import com.sharemechat.support.entity.SupportTicket;
import com.sharemechat.support.repository.SupportConversationRepository;
import com.sharemechat.support.repository.SupportMessageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * ADR-054 Fase T3.5 — tests del hook de oferta de ticket dentro del bot.
 * Cubre los 4 caminos: (a) heuristica detecta + ofrece, (b) usuario acepta ->
 * openTicket, (c) usuario rechaza -> flujo normal, (d) usuario ambiguo -> re-ask.
 */
class SupportBotServiceTicketOfferTest {

    private SupportConversationRepository convRepo;
    private SupportMessageRepository msgRepo;
    private SupportRateLimitService rateLimit;
    private KnowledgeBaseService kbService;
    private SupportBotRouterService router;
    private ClaudeApiClient claudeClient;
    private ClaudeApiProperties props;
    private UserRepository userRepo;
    private TicketOfferHeuristicService heuristic;
    private TicketOfferPendingCache cache;
    private TicketService ticketService;
    private SupportBotService svc;

    @BeforeEach
    void setUp() {
        convRepo = mock(SupportConversationRepository.class);
        msgRepo = mock(SupportMessageRepository.class);
        rateLimit = mock(SupportRateLimitService.class);
        kbService = mock(KnowledgeBaseService.class);
        router = mock(SupportBotRouterService.class);
        claudeClient = mock(ClaudeApiClient.class);
        props = mock(ClaudeApiProperties.class);
        userRepo = mock(UserRepository.class);
        heuristic = new TicketOfferHeuristicService(); // real, no mock — es puro
        cache = new TicketOfferPendingCache();          // real, no mock — es puro
        ticketService = mock(TicketService.class);

        // Conversation activa devuelta por getOrCreateActiveConversation.
        SupportConversation conv = new SupportConversation();
        setField(conv, "id", 500L);
        conv.setUserId(42L);
        conv.setResolutionStatus("OPEN");
        when(convRepo.findFirstByUserIdAndResolutionStatusInOrderByIdDesc(eq(42L), any()))
                .thenReturn(Optional.of(conv));
        when(convRepo.save(any(SupportConversation.class))).thenAnswer(inv -> inv.getArgument(0));
        when(convRepo.findById(500L)).thenReturn(Optional.of(conv));
        when(msgRepo.save(any(SupportMessage.class))).thenAnswer(inv -> {
            SupportMessage m = inv.getArgument(0);
            if (m.getId() == null) setField(m, "id", 9999L);
            return m;
        });
        when(rateLimit.remainingMessages(anyLong())).thenReturn(30);
        when(rateLimit.remainingTokens(anyLong())).thenReturn(50000L);
        // Guard rate limit: OFF por defecto.
        when(rateLimit.shouldRateLimit(anyLong())).thenReturn(false);

        svc = new SupportBotService(convRepo, msgRepo, rateLimit, kbService, router,
                claudeClient, props, userRepo, heuristic, cache, ticketService);
    }

    @Test
    @DisplayName("(a) Heuristica detecta STREAM_INTERRUPTED -> ofrece + guarda pending + NO llama LLM")
    void detects_and_offers() {
        SupportMessageResponseDTO out = svc.handleUserMessage(
                42L, "Se cayo el stream y me cobraron", "1.2.3.4");

        assertNotNull(out.getReply());
        assertTrue(out.getReply().toLowerCase().contains("ticket"), "reply debe mencionar ticket");
        assertTrue(out.getReply().toLowerCase().contains("streaming"), "reply debe mencionar la categoria");
        verifyNoInteractions(claudeClient);
        assertTrue(cache.get(500L).isPresent(), "cache debe guardar pending");
        assertEquals("STREAM_INTERRUPTED", cache.get(500L).get().category);
    }

    @Test
    @DisplayName("(b) User acepta -> openTicket con existingConversationId + limpia cache + HUMAN_HANDLING")
    void user_accepts_opens_ticket() {
        // Precondicion: hay pending offer.
        cache.put(500L, "STREAM_INTERRUPTED", "se cayo el stream");
        SupportTicket t = new SupportTicket();
        setField(t, "id", 77L);
        when(ticketService.openTicket(eq(42L), eq("STREAM_INTERRUPTED"),
                any(), any(), any(), any(), eq(500L))).thenReturn(t);

        SupportMessageResponseDTO out = svc.handleUserMessage(42L, "si", "1.2.3.4");

        assertNotNull(out.getReply());
        assertTrue(out.getReply().contains("#77"), "reply debe incluir ticketId");
        assertTrue(cache.get(500L).isEmpty(), "cache debe estar limpio");
        assertEquals(Boolean.TRUE, out.getHumanHandling());
        verifyNoInteractions(claudeClient);
        verify(ticketService).openTicket(eq(42L), eq("STREAM_INTERRUPTED"),
                eq("se cayo el stream"), any(), any(), any(), eq(500L));
    }

    @Test
    @DisplayName("(b-bis) openTicket lanza RateLimit -> reply informativo + NO abre ticket")
    void user_accepts_but_rate_limited() {
        cache.put(500L, "OTHER", "queja");
        when(ticketService.openTicket(anyLong(), any(), any(), any(), any(), any(), any()))
                .thenThrow(new TicketService.RateLimitExceededException("cap 2 abiertos"));
        SupportMessageResponseDTO out = svc.handleUserMessage(42L, "si", "1.2.3.4");
        assertTrue(out.getReply().toLowerCase().contains("no puedo"));
        assertTrue(cache.get(500L).isEmpty(), "cache limpiado igualmente");
    }

    @Test
    @DisplayName("(c) User rechaza -> limpia cache + reply confirmando + NO abre ticket + NO llama LLM aqui")
    void user_rejects() {
        cache.put(500L, "OTHER", "queja");
        SupportMessageResponseDTO out = svc.handleUserMessage(42L, "no gracias", "1.2.3.4");

        assertNotNull(out.getReply());
        assertTrue(out.getReply().toLowerCase().contains("entendido"));
        assertTrue(cache.get(500L).isEmpty(), "cache limpiado");
        verify(ticketService, never()).openTicket(anyLong(), any(), any(), any(), any(), any(), any());
        // Nota: el bot no continua al LLM en este mensaje. El siguiente
        // mensaje del user si ira al LLM porque el cache ya esta limpio.
        verifyNoInteractions(claudeClient);
    }

    @Test
    @DisplayName("(d) Confirmacion ambigua -> pide aclaracion + mantiene pending")
    void ambiguous_reask() {
        cache.put(500L, "OTHER", "queja");
        SupportMessageResponseDTO out = svc.handleUserMessage(42L, "tal vez luego", "1.2.3.4");

        assertNotNull(out.getReply());
        assertTrue(out.getReply().toLowerCase().contains("responde"));
        // Cache sigue vigente para dar segunda oportunidad.
        assertTrue(cache.get(500L).isPresent(), "pending debe persistir hasta respuesta clara");
        verify(ticketService, never()).openTicket(anyLong(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Sin senyal heuristica ni pending -> hook devuelve null y flujo continua a rate limit + LLM")
    void no_signal_falls_through() {
        // Mensaje neutro que no matchea ningun keyword.
        // Verificamos que el hook devolvio null porque se llega al rate limit
        // check (que va justo despues del hook).
        svc.handleUserMessage(42L, "Como cambio mi contrasena?", "1.2.3.4");
        verify(rateLimit).shouldRateLimit(42L);
    }

    private static void setField(Object obj, String name, Object value) {
        try {
            Class<?> c = obj.getClass();
            Field f = null;
            while (c != null && f == null) {
                try { f = c.getDeclaredField(name); }
                catch (NoSuchFieldException nsfe) { c = c.getSuperclass(); }
            }
            if (f == null) throw new NoSuchFieldException(name);
            f.setAccessible(true);
            f.set(obj, value);
        } catch (ReflectiveOperationException ex) {
            throw new RuntimeException(ex);
        }
    }
}
