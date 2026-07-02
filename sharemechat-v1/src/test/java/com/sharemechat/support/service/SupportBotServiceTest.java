package com.sharemechat.support.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.support.config.ClaudeApiProperties;
import com.sharemechat.support.dto.ClaudeApiResponse;
import com.sharemechat.support.dto.SupportMessageResponseDTO;
import com.sharemechat.support.entity.SupportConversation;
import com.sharemechat.support.entity.SupportMessage;
import com.sharemechat.support.repository.SupportConversationRepository;
import com.sharemechat.support.repository.SupportMessageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SupportBotServiceTest {

    private SupportConversationRepository convRepo;
    private SupportMessageRepository msgRepo;
    private SupportRateLimitService rateLimit;
    private SupportKnowledgeBaseLoader kb;
    private ClaudeApiClient claudeClient;
    private ClaudeApiProperties props;
    private UserRepository userRepo;
    private SupportBotService svc;

    @BeforeEach
    void setUp() throws Exception {
        convRepo = mock(SupportConversationRepository.class);
        msgRepo = mock(SupportMessageRepository.class);
        rateLimit = mock(SupportRateLimitService.class);
        kb = mock(SupportKnowledgeBaseLoader.class);
        claudeClient = mock(ClaudeApiClient.class);
        props = mock(ClaudeApiProperties.class);
        userRepo = mock(UserRepository.class);

        when(props.getHistoryMessagesWindow()).thenReturn(10);
        when(kb.getKnowledgeBase()).thenReturn("KB placeholder");
        when(convRepo.save(any(SupportConversation.class))).thenAnswer(inv -> {
            SupportConversation c = inv.getArgument(0);
            if (c.getId() == null) {
                java.lang.reflect.Field f = SupportConversation.class.getDeclaredField("id");
                f.setAccessible(true);
                f.set(c, 100L);
            }
            return c;
        });
        when(msgRepo.save(any(SupportMessage.class))).thenAnswer(inv -> {
            SupportMessage m = inv.getArgument(0);
            if (m.getId() == null) {
                java.lang.reflect.Field f = SupportMessage.class.getDeclaredField("id");
                f.setAccessible(true);
                f.set(m, 200L);
            }
            return m;
        });
        when(convRepo.findFirstByUserIdAndResolutionStatusOrderByIdDesc(anyLong(), anyString()))
                .thenReturn(Optional.empty());
        when(msgRepo.findByConversationIdOrderByIdDesc(anyLong(), any(Pageable.class))).thenReturn(List.of());
        when(userRepo.findById(anyLong())).thenReturn(Optional.empty());
        when(rateLimit.remainingMessages(anyLong())).thenReturn(29);
        when(rateLimit.remainingTokens(anyLong())).thenReturn(49500L);
        when(claudeClient.estimateCostMicros(anyInt(), anyInt())).thenReturn(35L);

        svc = new SupportBotService(convRepo, msgRepo, rateLimit, kb, claudeClient, props, userRepo);
    }

    @Test
    @DisplayName("handleUserMessage happy path -> LLM invocado, persistidos 2 mensajes, remaining bajo")
    void happyPath() throws Exception {
        ClaudeApiResponse r = new ClaudeApiResponse();
        r.setTextContent("Hola, soy soporte");
        r.setTokensInput(200);
        r.setTokensOutput(50);
        r.setModelId("claude-haiku-4-5");
        r.setFinishReason("end_turn");
        when(claudeClient.callMessages(anyString(), anyList(), anyString())).thenReturn(r);

        SupportMessageResponseDTO out = svc.handleUserMessage(7L, "Hola bot", "1.2.3.4");
        assertEquals("Hola, soy soporte", out.getReply());
        assertFalse(Boolean.TRUE.equals(out.getRateLimited()));
        assertFalse(Boolean.TRUE.equals(out.getEscalated()));
        verify(msgRepo, atLeast(2)).save(any(SupportMessage.class));
        verify(rateLimit).registerUsage(eq(7L), eq(250));
    }

    @Test
    @DisplayName("rate limit exceeded -> LLM NO invocado, RATE_LIMITED, mensaje canonico")
    void rateLimitedPath() {
        when(rateLimit.shouldRateLimit(7L)).thenReturn(true);
        SupportMessageResponseDTO out = svc.handleUserMessage(7L, "Hola", "1.1.1.1");
        assertEquals(Constants.SupportResolutionStatuses.RATE_LIMITED, out.getResolutionStatus());
        assertTrue(out.getRateLimited());
        assertEquals(SupportBotService.RATE_LIMIT_MESSAGE_ES, out.getReply());
        try {
            verify(claudeClient, never()).callMessages(anyString(), anyList(), anyString());
        } catch (Exception ignore) {}
    }

    @Test
    @DisplayName("escalado automatico tool_use -> conversation ESCALATED con reason")
    void escalationAutoPath() throws Exception {
        ClaudeApiResponse r = new ClaudeApiResponse();
        r.setTextContent("Te derivo con humano");
        r.setTokensInput(80);
        r.setTokensOutput(40);
        r.setEscalationToolCalled(true);
        r.setEscalationReason("cargo duplicado sesion 123");
        when(claudeClient.callMessages(anyString(), anyList(), anyString())).thenReturn(r);

        SupportMessageResponseDTO out = svc.handleUserMessage(7L, "cobrado dos veces", "1.1.1.1");
        assertEquals(Constants.SupportResolutionStatuses.ESCALATED, out.getResolutionStatus());
        assertTrue(out.getEscalated());
        assertEquals("cargo duplicado sesion 123", out.getEscalationReason());

        ArgumentCaptor<SupportConversation> convCap = ArgumentCaptor.forClass(SupportConversation.class);
        verify(convRepo, atLeast(2)).save(convCap.capture());
        SupportConversation last = convCap.getValue();
        assertEquals(Constants.SupportResolutionStatuses.ESCALATED, last.getResolutionStatus());
        assertTrue(last.isEscalatedByLlm());
        assertNotNull(last.getEscalatedAt());
    }

    @Test
    @DisplayName("escalado manual -> conversation ESCALATED con escalated_by_llm=false")
    void escalationManual() {
        SupportConversation conv = svc.escalateManual(7L, "quiero hablar con persona real");
        assertEquals(Constants.SupportResolutionStatuses.ESCALATED, conv.getResolutionStatus());
        assertFalse(conv.isEscalatedByLlm());
        assertEquals("quiero hablar con persona real", conv.getEscalationReason());
    }

    @Test
    @DisplayName("escalado manual sin reason -> reason default 'user_request'")
    void escalationManualDefault() {
        SupportConversation conv = svc.escalateManual(7L, null);
        assertEquals("user_request", conv.getEscalationReason());
    }

    @Test
    @DisplayName("mensaje vacio -> IllegalArgumentException")
    void emptyMessage() {
        assertThrows(IllegalArgumentException.class,
                () -> svc.handleUserMessage(7L, "   ", "1.1.1.1"));
    }

    @Test
    @DisplayName("userId null -> IllegalArgumentException")
    void nullUser() {
        assertThrows(IllegalArgumentException.class,
                () -> svc.handleUserMessage(null, "hola", "1.1.1.1"));
    }

    @Test
    @DisplayName("mensaje demasiado largo -> IllegalArgumentException")
    void tooLongMessage() {
        String big = "x".repeat(5000);
        assertThrows(IllegalArgumentException.class,
                () -> svc.handleUserMessage(7L, big, "1.1.1.1"));
    }

    @Test
    @DisplayName("LLM error -> mensaje SYSTEM persistido, respuesta canonica")
    void llmErrorPath() throws Exception {
        when(claudeClient.callMessages(anyString(), anyList(), anyString()))
                .thenThrow(new RuntimeException("timeout"));
        SupportMessageResponseDTO out = svc.handleUserMessage(7L, "hola", "1.1.1.1");
        assertEquals(SupportBotService.LLM_UNAVAILABLE_MESSAGE_ES, out.getReply());
    }

    @Test
    @DisplayName("system prompt incluye email + role + verification_status del usuario")
    void systemPromptIncludesUserContext() throws Exception {
        User u = new User();
        u.setEmail("cliente@example.com");
        u.setRole(Constants.Roles.CLIENT);
        u.setVerificationStatus("APPROVED");
        when(userRepo.findById(7L)).thenReturn(Optional.of(u));

        ClaudeApiResponse r = new ClaudeApiResponse();
        r.setTextContent("ok");
        r.setTokensInput(50);
        r.setTokensOutput(10);
        when(claudeClient.callMessages(anyString(), anyList(), anyString())).thenReturn(r);

        ArgumentCaptor<String> sysCap = ArgumentCaptor.forClass(String.class);
        svc.handleUserMessage(7L, "hola", "1.1.1.1");
        verify(claudeClient).callMessages(sysCap.capture(), anyList(), anyString());
        String sysPrompt = sysCap.getValue();
        assertTrue(sysPrompt.contains("cliente@example.com"));
        assertTrue(sysPrompt.contains("CLIENT"));
        assertTrue(sysPrompt.contains("APPROVED"));
        assertTrue(sysPrompt.contains("KB placeholder"));
    }

    @Test
    @DisplayName("history window respeta el limite configurado")
    void historyWindowLimit() throws Exception {
        when(props.getHistoryMessagesWindow()).thenReturn(5);
        ClaudeApiResponse r = new ClaudeApiResponse();
        r.setTextContent("ok");
        when(claudeClient.callMessages(anyString(), anyList(), anyString())).thenReturn(r);

        ArgumentCaptor<Pageable> pageCap = ArgumentCaptor.forClass(Pageable.class);
        svc.handleUserMessage(7L, "hola", "1.1.1.1");
        verify(msgRepo).findByConversationIdOrderByIdDesc(anyLong(), pageCap.capture());
        assertEquals(5, pageCap.getValue().getPageSize());
    }
}
