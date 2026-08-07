package com.sharemechat.support.service;

import com.sharemechat.support.entity.SupportConversation;
import com.sharemechat.support.entity.SupportTicket;
import com.sharemechat.support.repository.SupportConversationRepository;
import com.sharemechat.support.repository.SupportTicketRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.*;

/**
 * ADR-054 Fase T1.6 — tests unitarios de {@link TicketService}. Cubre:
 * apertura + rate limits D7, transiciones D6 validas e invalidas,
 * high_history_flag informativo (>=3 compensados en 90d).
 */
class TicketServiceTest {

    private SupportTicketRepository ticketRepo;
    private SupportConversationRepository convRepo;
    private TicketService svc;

    @BeforeEach
    void setUp() {
        ticketRepo = mock(SupportTicketRepository.class);
        convRepo = mock(SupportConversationRepository.class);
        svc = new TicketService(ticketRepo, convRepo);

        when(convRepo.save(any(SupportConversation.class))).thenAnswer(inv -> {
            SupportConversation c = inv.getArgument(0);
            if (c.getId() == null) {
                try {
                    var f = SupportConversation.class.getDeclaredField("id");
                    f.setAccessible(true);
                    f.set(c, 555L);
                } catch (ReflectiveOperationException ex) {
                    throw new RuntimeException(ex);
                }
            }
            return c;
        });
        when(ticketRepo.save(any(SupportTicket.class))).thenAnswer(inv -> {
            SupportTicket t = inv.getArgument(0);
            if (t.getId() == null) {
                try {
                    var f = SupportTicket.class.getDeclaredField("id");
                    f.setAccessible(true);
                    f.set(t, 42L);
                } catch (ReflectiveOperationException ex) {
                    throw new RuntimeException(ex);
                }
            }
            return t;
        });
    }

    // ============================================================
    // Apertura + rate limits
    // ============================================================

    @Test
    @DisplayName("openTicket happy path: crea conversacion HUMAN_HANDLING + ticket OPEN con highHistoryFlag=false")
    void openTicket_happy_path() {
        when(ticketRepo.countByUserIdAndStatusIn(eq(1L), anyCollection())).thenReturn(0L);
        when(ticketRepo.countByUserIdAndCreatedAtGreaterThanEqual(eq(1L), any())).thenReturn(0L);
        when(ticketRepo.countByUserIdAndStatusAndResolvedAtGreaterThanEqual(
                eq(1L), eq("RESOLVED_COMPENSATED"), any())).thenReturn(0L);

        SupportTicket t = svc.openTicket(1L, "STREAM_INTERRUPTED",
                "El stream se corto en el minuto 3", LocalDateTime.now(), 100L, null);

        assertEquals("OPEN", t.getStatus());
        assertEquals(1L, t.getUserId());
        assertEquals("STREAM_INTERRUPTED", t.getCategory());
        assertEquals(555L, t.getLinkedConversationId());
        assertEquals(100L, t.getLinkedStreamRecordId());
        assertFalse(t.isHighHistoryFlag());
        verify(convRepo).save(argThat(c -> "HUMAN_HANDLING".equals(c.getResolutionStatus())));
    }

    @Test
    @DisplayName("openTicket rate limit: rechaza si user tiene ya 5 tickets abiertos")
    void openTicket_rejects_when_max_open_reached() {
        // MAX_OPEN_TICKETS_PER_USER=5 tras el subido de 2026-08-07 (UX feedback).
        when(ticketRepo.countByUserIdAndStatusIn(eq(1L), anyCollection())).thenReturn(5L);
        assertThrows(TicketService.RateLimitExceededException.class,
                () -> svc.openTicket(1L, "OTHER", "desc", null, null, null));
        verify(ticketRepo, never()).save(any());
    }

    @Test
    @DisplayName("openTicket rate limit: rechaza si user creo ya 5 tickets en 30 dias")
    void openTicket_rejects_when_5_in_30d() {
        when(ticketRepo.countByUserIdAndStatusIn(eq(1L), anyCollection())).thenReturn(0L);
        when(ticketRepo.countByUserIdAndCreatedAtGreaterThanEqual(eq(1L), any())).thenReturn(5L);
        assertThrows(TicketService.RateLimitExceededException.class,
                () -> svc.openTicket(1L, "OTHER", "desc", null, null, null));
    }

    @Test
    @DisplayName("openTicket highHistoryFlag=true cuando user tiene >=3 compensados en 90d")
    void openTicket_marks_high_history_flag() {
        when(ticketRepo.countByUserIdAndStatusIn(eq(1L), anyCollection())).thenReturn(0L);
        when(ticketRepo.countByUserIdAndCreatedAtGreaterThanEqual(eq(1L), any())).thenReturn(0L);
        when(ticketRepo.countByUserIdAndStatusAndResolvedAtGreaterThanEqual(
                eq(1L), eq("RESOLVED_COMPENSATED"), any())).thenReturn(3L);
        SupportTicket t = svc.openTicket(1L, "OTHER", "desc", null, null, null);
        assertTrue(t.isHighHistoryFlag());
    }

    @Test
    @DisplayName("openTicket valida categoria (rechaza fuera del enum)")
    void openTicket_rejects_invalid_category() {
        assertThrows(IllegalArgumentException.class,
                () -> svc.openTicket(1L, "FAKE_CATEGORY", "desc", null, null, null));
    }

    @Test
    @DisplayName("openTicket exige descripcion no vacia")
    void openTicket_rejects_blank_description() {
        assertThrows(IllegalArgumentException.class,
                () -> svc.openTicket(1L, "OTHER", "   ", null, null, null));
    }

    // ============================================================
    // Transiciones D6
    // ============================================================

    @Test
    @DisplayName("isValidTransition: happy path completo (OPEN -> INVESTIGATING -> PENDING_CREDIT -> COMPENSATED)")
    void isValidTransition_happy_full_path() {
        assertTrue(TicketService.isValidTransition("OPEN", "INVESTIGATING"));
        assertTrue(TicketService.isValidTransition("INVESTIGATING", "RESOLVED_COMPENSATED_PENDING_CREDIT"));
        assertTrue(TicketService.isValidTransition("RESOLVED_COMPENSATED_PENDING_CREDIT", "RESOLVED_COMPENSATED"));
    }

    @Test
    @DisplayName("isValidTransition: OPEN -> RESOLVED_COMPENSATED_PENDING_CREDIT directo NO permitido (fuerza pasar por INVESTIGATING)")
    void isValidTransition_no_shortcut_from_open() {
        assertFalse(TicketService.isValidTransition("OPEN", "RESOLVED_COMPENSATED_PENDING_CREDIT"));
        assertFalse(TicketService.isValidTransition("OPEN", "RESOLVED_COMPENSATED"));
    }

    @Test
    @DisplayName("isValidTransition: estados terminales no admiten mas transiciones")
    void isValidTransition_terminal_no_more() {
        assertFalse(TicketService.isValidTransition("RESOLVED_COMPENSATED", "INVESTIGATING"));
        assertFalse(TicketService.isValidTransition("RESOLVED_NO_COMPENSATION", "OPEN"));
        assertFalse(TicketService.isValidTransition("REJECTED_INVALID", "INVESTIGATING"));
        assertFalse(TicketService.isValidTransition("ABANDONED", "INVESTIGATING"));
    }

    @Test
    @DisplayName("isValidTransition: OPEN -> REJECTED_INVALID permitido (rechazo directo por spam/duplicado)")
    void isValidTransition_open_to_rejected() {
        assertTrue(TicketService.isValidTransition("OPEN", "REJECTED_INVALID"));
    }

    @Test
    @DisplayName("isValidTransition: INVESTIGATING puede terminar en NO_COMPENSATION o ABANDONED")
    void isValidTransition_investigating_terminations() {
        assertTrue(TicketService.isValidTransition("INVESTIGATING", "RESOLVED_NO_COMPENSATION"));
        assertTrue(TicketService.isValidTransition("INVESTIGATING", "ABANDONED"));
    }

    @Test
    @DisplayName("transitionStatus: aplica nueva transicion valida y marca resolvedAt en estados terminales de resolucion")
    void transitionStatus_marks_resolved_metadata() {
        SupportTicket t = new SupportTicket();
        t.setStatus("INVESTIGATING");
        t.setUserId(1L);
        try {
            var f = SupportTicket.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(t, 10L);
        } catch (ReflectiveOperationException ex) {
            fail(ex);
        }
        when(ticketRepo.findById(10L)).thenReturn(java.util.Optional.of(t));

        SupportTicket updated = svc.transitionStatus(10L, "RESOLVED_NO_COMPENSATION", 99L, "sin evidencia");
        assertEquals("RESOLVED_NO_COMPENSATION", updated.getStatus());
        assertNotNull(updated.getResolvedAt());
        assertEquals(99L, updated.getResolvedByAdminId());
        assertEquals("sin evidencia", updated.getResolutionNotes());
    }

    @Test
    @DisplayName("transitionStatus: transicion invalida lanza IllegalStateException")
    void transitionStatus_invalid_throws() {
        SupportTicket t = new SupportTicket();
        t.setStatus("OPEN");
        when(ticketRepo.findById(10L)).thenReturn(java.util.Optional.of(t));
        assertThrows(IllegalStateException.class,
                () -> svc.transitionStatus(10L, "RESOLVED_COMPENSATED", 99L, null));
    }
}
