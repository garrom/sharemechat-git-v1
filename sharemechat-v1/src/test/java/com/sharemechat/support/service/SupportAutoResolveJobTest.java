package com.sharemechat.support.service;

import com.sharemechat.repository.UserRepository;
import com.sharemechat.support.entity.SupportConversation;
import com.sharemechat.support.entity.SupportMessage;
import com.sharemechat.support.repository.SupportConversationRepository;
import com.sharemechat.support.repository.SupportMessageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * ADR-046 hardening: auto-cierre por inactividad SOLO cuando calla el usuario
 * (ultimo mensaje no suyo). Repo mockeado, sin contexto Spring.
 */
class SupportAutoResolveJobTest {

    private SupportConversationRepository convRepo;
    private SupportMessageRepository msgRepo;
    private UserRepository userRepo;
    private SupportAutoResolveJob job;

    @BeforeEach
    void setUp() {
        convRepo = mock(SupportConversationRepository.class);
        msgRepo = mock(SupportMessageRepository.class);
        userRepo = mock(UserRepository.class);
        job = new SupportAutoResolveJob(convRepo, msgRepo, userRepo);
        job.enabled = true;
        job.inactivityDays = 3;
        when(userRepo.findById(anyLong())).thenReturn(Optional.empty()); // locale -> es
    }

    private static SupportConversation humanHandling(Long userId) {
        SupportConversation c = new SupportConversation();
        c.setUserId(userId);
        c.setResolutionStatus("HUMAN_HANDLING");
        return c;
    }

    private static SupportMessage msg(String sender) {
        SupportMessage m = new SupportMessage();
        m.setSender(sender);
        return m;
    }

    @Test
    @DisplayName("cierra si el ULTIMO mensaje NO es del usuario (inactividad del usuario)")
    void closes_when_last_message_not_user() {
        SupportConversation c = humanHandling(10L);
        when(convRepo.findByResolutionStatusAndUpdatedAtBefore(eq("HUMAN_HANDLING"), any()))
                .thenReturn(List.of(c));
        when(msgRepo.findFirstByConversationIdOrderByIdDesc(any())).thenReturn(msg("HUMAN"));

        job.run();

        assertEquals("RESOLVED", c.getResolutionStatus());
        verify(convRepo).save(c);
        verify(msgRepo).save(any(SupportMessage.class)); // mensaje SYSTEM de cierre
    }

    @Test
    @DisplayName("NO cierra si el ULTIMO mensaje es del usuario (nos espera a nosotros)")
    void skips_when_last_message_is_user() {
        SupportConversation c = humanHandling(10L);
        when(convRepo.findByResolutionStatusAndUpdatedAtBefore(any(), any()))
                .thenReturn(List.of(c));
        when(msgRepo.findFirstByConversationIdOrderByIdDesc(any())).thenReturn(msg("USER"));

        job.run();

        assertEquals("HUMAN_HANDLING", c.getResolutionStatus(), "no debe tocar el estado");
        verify(convRepo, never()).save(any());
        verify(msgRepo, never()).save(any());
    }

    @Test
    @DisplayName("deshabilitado: no hace nada")
    void disabled_does_nothing() {
        job.enabled = false;
        job.run();
        verifyNoInteractions(convRepo);
        verifyNoInteractions(msgRepo);
    }

    @Test
    @DisplayName("sin mensajes (last=null): se cierra (no hay usuario esperando)")
    void closes_when_no_messages() {
        SupportConversation c = humanHandling(10L);
        when(convRepo.findByResolutionStatusAndUpdatedAtBefore(any(), any()))
                .thenReturn(List.of(c));
        when(msgRepo.findFirstByConversationIdOrderByIdDesc(any())).thenReturn(null);

        job.run();

        assertEquals("RESOLVED", c.getResolutionStatus());
    }

    @Test
    @DisplayName("mensaje de cierre localizado ES/EN")
    void closing_message_locale() {
        assertTrue(SupportAutoResolveJob.closingMessage("es").toLowerCase().contains("inactividad"));
        assertTrue(SupportAutoResolveJob.closingMessage("en").toLowerCase().contains("inactivity"));
    }
}
