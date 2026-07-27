package com.sharemechat.support.controller;

import com.sharemechat.entity.User;
import com.sharemechat.service.UserService;
import com.sharemechat.support.dto.TransitionTicketStatusRequestDTO;
import com.sharemechat.support.entity.SupportTicket;
import com.sharemechat.support.repository.SupportTicketRepository;
import com.sharemechat.support.service.TicketService;
import com.sharemechat.support.service.TicketVerificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * ADR-054 Fase T2.5 — tests unit-style de {@link AdminTicketController}.
 * El guard PERM_SUPPORT_TICKETS_HANDLE se enforca en SecurityConfig via
 * matcher (validado por integration en TEST post-deploy).
 */
class AdminTicketControllerTest {

    private TicketService ticketService;
    private TicketVerificationService verificationService;
    private SupportTicketRepository ticketRepo;
    private UserService userService;
    private Authentication auth;
    private AdminTicketController controller;

    @BeforeEach
    void setUp() throws Exception {
        ticketService = mock(TicketService.class);
        verificationService = mock(TicketVerificationService.class);
        ticketRepo = mock(SupportTicketRepository.class);
        userService = mock(UserService.class);
        auth = mock(Authentication.class);
        when(auth.getName()).thenReturn("admin@example.com");
        User admin = new User();
        java.lang.reflect.Field f = User.class.getDeclaredField("id");
        f.setAccessible(true);
        f.set(admin, 1L);
        admin.setEmail("admin@example.com");
        when(userService.findByEmail("admin@example.com")).thenReturn(admin);
        controller = new AdminTicketController(ticketService, verificationService, ticketRepo, userService);
    }

    @Test
    @DisplayName("GET / listado sin filtros -> 200 con content vacio")
    void list_all_ok_empty() {
        Page<SupportTicket> pg = new PageImpl<>(List.of());
        when(ticketRepo.findFiltered(any(), any(), any(Pageable.class))).thenReturn(pg);
        ResponseEntity<?> resp = controller.listAll(null, null, 0, 20, auth);
        assertEquals(HttpStatus.OK, resp.getStatusCode());
    }

    @Test
    @DisplayName("POST /{id}/verify -> 200 con JSON del servicio")
    void verify_ok() {
        when(verificationService.verify(10L)).thenReturn("{\"signalStrength\":\"NEUTRAL\"}");
        ResponseEntity<?> resp = controller.verify(10L, auth);
        assertEquals(HttpStatus.OK, resp.getStatusCode());
    }

    @Test
    @DisplayName("POST /{id}/verify ticket inexistente -> 404")
    void verify_not_found() {
        when(verificationService.verify(999L))
                .thenThrow(new IllegalArgumentException("Ticket no encontrado id=999"));
        ResponseEntity<?> resp = controller.verify(999L, auth);
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
    }

    @Test
    @DisplayName("PATCH /{id}/status happy path -> 200")
    void transition_ok() {
        SupportTicket t = new SupportTicket();
        t.setStatus("INVESTIGATING");
        t.setCategory("OTHER");
        t.setDescription("d");
        t.setUserId(50L);
        when(ticketService.transitionStatus(eq(10L), eq("RESOLVED_NO_COMPENSATION"), eq(1L), anyString()))
                .thenReturn(t);
        TransitionTicketStatusRequestDTO body = new TransitionTicketStatusRequestDTO();
        body.setNewStatus("RESOLVED_NO_COMPENSATION");
        body.setNotes("sin evidencia");
        ResponseEntity<?> resp = controller.transition(10L, body, auth);
        assertEquals(HttpStatus.OK, resp.getStatusCode());
    }

    @Test
    @DisplayName("PATCH /{id}/status RESOLVED_COMPENSATED directo -> 400 (fuerza refund endpoint)")
    void transition_blocks_direct_compensated() {
        TransitionTicketStatusRequestDTO body = new TransitionTicketStatusRequestDTO();
        body.setNewStatus("RESOLVED_COMPENSATED");
        ResponseEntity<?> resp = controller.transition(10L, body, auth);
        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
        verify(ticketService, never()).transitionStatus(anyLong(), anyString(), any(), any());
    }

    @Test
    @DisplayName("PATCH /{id}/status transicion invalida -> 400")
    void transition_invalid() {
        when(ticketService.transitionStatus(anyLong(), anyString(), any(), any()))
                .thenThrow(new IllegalStateException("Transicion invalida OPEN -> RESOLVED_COMPENSATED"));
        TransitionTicketStatusRequestDTO body = new TransitionTicketStatusRequestDTO();
        body.setNewStatus("REJECTED_INVALID");
        ResponseEntity<?> resp = controller.transition(10L, body, auth);
        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
    }

    @Test
    @DisplayName("PATCH /{id}/status sin newStatus -> 400")
    void transition_missing_status() {
        TransitionTicketStatusRequestDTO body = new TransitionTicketStatusRequestDTO();
        ResponseEntity<?> resp = controller.transition(10L, body, auth);
        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
    }
}
