package com.sharemechat.support.controller;

import com.sharemechat.entity.User;
import com.sharemechat.service.UserService;
import com.sharemechat.support.dto.OpenTicketRequestDTO;
import com.sharemechat.support.entity.SupportTicket;
import com.sharemechat.support.service.TicketService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * ADR-054 Fase T2.5 — tests unit-style de {@link TicketController}. Foco en
 * mapping de errores (400/404/429) y ownership. Los tests MockMvc completos
 * con SecurityConfig se validan en la integracion en TEST tras deploy.
 */
class TicketControllerTest {

    private TicketService ticketService;
    private UserService userService;
    private Authentication auth;
    private TicketController controller;

    @BeforeEach
    void setUp() throws Exception {
        ticketService = mock(TicketService.class);
        userService = mock(UserService.class);
        auth = mock(Authentication.class);
        when(auth.getName()).thenReturn("client@example.com");
        User u = new User();
        java.lang.reflect.Field f = User.class.getDeclaredField("id");
        f.setAccessible(true);
        f.set(u, 42L);
        u.setEmail("client@example.com");
        when(userService.findByEmail("client@example.com")).thenReturn(u);
        controller = new TicketController(ticketService, userService);
    }

    @Test
    @DisplayName("POST / OK -> 200 con TicketResponseDTO")
    void open_ok() {
        SupportTicket t = new SupportTicket();
        t.setUserId(42L);
        t.setCategory("STREAM_INTERRUPTED");
        t.setStatus("OPEN");
        t.setDescription("desc");
        when(ticketService.openTicket(eq(42L), eq("STREAM_INTERRUPTED"),
                eq("desc"), any(), any(), any())).thenReturn(t);

        OpenTicketRequestDTO body = new OpenTicketRequestDTO();
        body.setCategory("STREAM_INTERRUPTED");
        body.setDescription("desc");
        ResponseEntity<?> resp = controller.open(body, auth);
        assertEquals(HttpStatus.OK, resp.getStatusCode());
    }

    @Test
    @DisplayName("POST / con category invalida -> 400")
    void open_invalid_category() {
        when(ticketService.openTicket(eq(42L), eq("BAD"), any(), any(), any(), any()))
                .thenThrow(new IllegalArgumentException("category invalida: BAD"));
        OpenTicketRequestDTO body = new OpenTicketRequestDTO();
        body.setCategory("BAD");
        body.setDescription("desc");
        ResponseEntity<?> resp = controller.open(body, auth);
        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
    }

    @Test
    @DisplayName("POST / rate limit excedido -> 429")
    void open_rate_limited() {
        when(ticketService.openTicket(eq(42L), anyString(), anyString(), any(), any(), any()))
                .thenThrow(new TicketService.RateLimitExceededException("cap 2"));
        OpenTicketRequestDTO body = new OpenTicketRequestDTO();
        body.setCategory("OTHER");
        body.setDescription("desc");
        ResponseEntity<?> resp = controller.open(body, auth);
        assertEquals(429, resp.getStatusCode().value());
    }

    @Test
    @DisplayName("POST / sin auth -> 400 con 'No autenticado'")
    void open_no_auth() {
        OpenTicketRequestDTO body = new OpenTicketRequestDTO();
        body.setCategory("OTHER");
        body.setDescription("desc");
        ResponseEntity<?> resp = controller.open(body, null);
        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
    }

    @Test
    @DisplayName("GET / listMine -> 200 con lista")
    void list_mine_ok() {
        when(ticketService.listByUser(42L)).thenReturn(List.of());
        ResponseEntity<?> resp = controller.listMine(auth);
        assertEquals(HttpStatus.OK, resp.getStatusCode());
    }

    @Test
    @DisplayName("GET /{id} detalle ownership OK -> 200")
    void get_mine_ok() {
        SupportTicket t = new SupportTicket();
        t.setUserId(42L);
        t.setCategory("OTHER");
        t.setDescription("d");
        when(ticketService.findByIdForUser(10L, 42L)).thenReturn(t);
        ResponseEntity<?> resp = controller.getMine(10L, auth);
        assertEquals(HttpStatus.OK, resp.getStatusCode());
    }

    @Test
    @DisplayName("GET /{id} de otro user -> 404 (findByIdForUser lanza IllegalArgument)")
    void get_mine_ownership_denied() {
        when(ticketService.findByIdForUser(10L, 42L))
                .thenThrow(new IllegalArgumentException("Ticket no encontrado"));
        ResponseEntity<?> resp = controller.getMine(10L, auth);
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
    }
}
