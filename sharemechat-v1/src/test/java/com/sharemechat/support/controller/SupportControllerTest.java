package com.sharemechat.support.controller;

import com.sharemechat.entity.User;
import com.sharemechat.service.UserService;
import com.sharemechat.support.dto.SupportMessageRequestDTO;
import com.sharemechat.support.dto.SupportMessageResponseDTO;
import com.sharemechat.support.entity.SupportConversation;
import com.sharemechat.support.service.SupportBotService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class SupportControllerTest {

    private SupportBotService botService;
    private UserService userService;
    private Authentication auth;
    private HttpServletRequest req;
    private SupportController controller;

    @BeforeEach
    void setUp() throws Exception {
        botService = mock(SupportBotService.class);
        userService = mock(UserService.class);
        auth = mock(Authentication.class);
        req = mock(HttpServletRequest.class);
        when(auth.getName()).thenReturn("user@example.com");
        User u = new User();
        java.lang.reflect.Field f = User.class.getDeclaredField("id");
        f.setAccessible(true);
        f.set(u, 42L);
        u.setEmail("user@example.com");
        when(userService.findByEmail("user@example.com")).thenReturn(u);
        when(req.getRemoteAddr()).thenReturn("1.2.3.4");
        controller = new SupportController(botService, userService);
    }

    @Test
    @DisplayName("POST /message OK -> 200 delega a service")
    void okPath() {
        SupportMessageResponseDTO dto = new SupportMessageResponseDTO();
        dto.setReply("hola");
        when(botService.handleUserMessage(eq(42L), anyString(), anyString())).thenReturn(dto);

        SupportMessageRequestDTO body = new SupportMessageRequestDTO();
        body.setMessage("hola bot");
        ResponseEntity<?> resp = controller.sendMessage(body, auth, req);
        assertEquals(HttpStatus.OK, resp.getStatusCode());
        verify(botService).handleUserMessage(eq(42L), eq("hola bot"), anyString());
    }

    @Test
    @DisplayName("POST /message sin auth -> 400 (IllegalArgumentException 'No autenticado')")
    void noAuth() {
        SupportMessageRequestDTO body = new SupportMessageRequestDTO();
        body.setMessage("hola");
        ResponseEntity<?> resp = controller.sendMessage(body, null, req);
        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
    }

    @Test
    @DisplayName("POST /message body invalido -> 400")
    void invalidBody() {
        when(botService.handleUserMessage(anyLong(), any(), anyString()))
                .thenThrow(new IllegalArgumentException("message vacio"));
        SupportMessageRequestDTO body = new SupportMessageRequestDTO();
        body.setMessage("");
        ResponseEntity<?> resp = controller.sendMessage(body, auth, req);
        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
    }

    @Test
    @DisplayName("POST /escalate-manual OK -> 200 con conversationId + status ESCALATED")
    void escalateManualOk() {
        SupportConversation c = new SupportConversation();
        try {
            java.lang.reflect.Field f = SupportConversation.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(c, 5L);
        } catch (Exception ignore) {}
        c.setResolutionStatus("ESCALATED");
        c.setEscalationReason("user_request");
        when(botService.escalateManual(eq(42L), anyString())).thenReturn(c);

        ResponseEntity<?> resp = controller.escalateManual(5L, Map.of("reason", "user_request"), auth);
        assertEquals(HttpStatus.OK, resp.getStatusCode());
    }

    @Test
    @DisplayName("POST /escalate-manual sin body -> 200 (reason por default)")
    void escalateManualNoBody() {
        SupportConversation c = new SupportConversation();
        try {
            java.lang.reflect.Field f = SupportConversation.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(c, 6L);
        } catch (Exception ignore) {}
        c.setResolutionStatus("ESCALATED");
        c.setEscalationReason("user_request");
        when(botService.escalateManual(eq(42L), any())).thenReturn(c);
        ResponseEntity<?> resp = controller.escalateManual(6L, null, auth);
        assertEquals(HttpStatus.OK, resp.getStatusCode());
    }
}
