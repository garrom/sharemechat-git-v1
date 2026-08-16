package com.sharemechat.security;

import com.sharemechat.config.ProductOperationalProperties;
import com.sharemechat.config.ProductOperationalProperties.Mode;
import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import com.sharemechat.service.ProductOperationalModeService;
import com.sharemechat.service.UserService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.http.server.ServletServerHttpResponse;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.HashMap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * ADR-059 — modo-por-rol en la capa WEBSOCKET (ProductOperationalModeWsInterceptor,
 * feat(gate) 6af36bf1). Simétrico al filter REST: verifica resolveIsModel por
 * userId (vía UserService, fail-closed) y que en PRELAUNCH global + modeModel
 * OPEN la modelo pasa el handshake mientras el cliente se bloquea (503).
 *
 * Unit puro (Mockito + Spring mock-web; SIN Spring context ni Docker → corre en local).
 */
class ProductOperationalModeWsInterceptorTest {

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private ProductOperationalModeService serviceClientePrelaunchModeloOpen() {
        ProductOperationalProperties p = new ProductOperationalProperties();
        p.getAccess().setMode(Mode.PRELAUNCH);
        p.getAccess().setModeModel(Mode.OPEN);
        return new ProductOperationalModeService(p);
    }

    private JwtUtil jwtResolvingTo(Long userId) {
        JwtUtil jwt = mock(JwtUtil.class);
        when(jwt.isTokenValid(any())).thenReturn(true);
        when(jwt.extractUserId(any())).thenReturn(userId);
        return jwt;
    }

    private User user(String role, String userType) {
        User u = new User();
        u.setRole(role);
        u.setUserType(userType);
        return u;
    }

    private ServletServerHttpRequest wsRequest(boolean withCookie) {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setRequestURI("/match");
        if (withCookie) {
            req.setCookies(new Cookie("access_token", "tok"));
        }
        return new ServletServerHttpRequest(req);
    }

    private boolean handshake(ProductOperationalModeWsInterceptor interceptor,
                              ServletServerHttpRequest req, MockHttpServletResponse rawResp) throws Exception {
        ServletServerHttpResponse resp = new ServletServerHttpResponse(rawResp);
        return interceptor.beforeHandshake(req, resp, null, new HashMap<>());
    }

    // ---- casos ----

    @Test
    void modelo_pasaElHandshake_enPrelaunchGlobalConModeloOpen() throws Exception {
        UserService userService = mock(UserService.class);
        when(userService.findById(5L)).thenReturn(user(Constants.Roles.MODEL, null));
        ProductOperationalModeWsInterceptor interceptor =
                new ProductOperationalModeWsInterceptor(serviceClientePrelaunchModeloOpen(), jwtResolvingTo(5L), userService);

        MockHttpServletResponse rawResp = new MockHttpServletResponse();
        boolean allowed = handshake(interceptor, wsRequest(true), rawResp);

        assertTrue(allowed);
        assertEquals(200, rawResp.getStatus()); // sin bloqueo
    }

    @Test
    void candidataUserFormModel_pasaElHandshake() throws Exception {
        UserService userService = mock(UserService.class);
        when(userService.findById(anyLong()))
                .thenReturn(user(Constants.Roles.USER, Constants.UserTypes.FORM_MODEL));
        ProductOperationalModeWsInterceptor interceptor =
                new ProductOperationalModeWsInterceptor(serviceClientePrelaunchModeloOpen(), jwtResolvingTo(9L), userService);

        assertTrue(handshake(interceptor, wsRequest(true), new MockHttpServletResponse()));
    }

    @Test
    void cliente_seBloquea_con503() throws Exception {
        UserService userService = mock(UserService.class);
        when(userService.findById(anyLong()))
                .thenReturn(user(Constants.Roles.USER, Constants.UserTypes.FORM_CLIENT));
        ProductOperationalModeWsInterceptor interceptor =
                new ProductOperationalModeWsInterceptor(serviceClientePrelaunchModeloOpen(), jwtResolvingTo(7L), userService);

        MockHttpServletResponse rawResp = new MockHttpServletResponse();
        boolean allowed = handshake(interceptor, wsRequest(true), rawResp);

        assertFalse(allowed);
        assertEquals(503, rawResp.getStatus());
    }

    @Test
    void sinCookie_failClosed_seBloquea() throws Exception {
        UserService userService = mock(UserService.class); // findById nunca se llama (userId null)
        ProductOperationalModeWsInterceptor interceptor =
                new ProductOperationalModeWsInterceptor(serviceClientePrelaunchModeloOpen(), mock(JwtUtil.class), userService);

        MockHttpServletResponse rawResp = new MockHttpServletResponse();
        assertFalse(handshake(interceptor, wsRequest(false), rawResp));
        assertEquals(503, rawResp.getStatus());
    }

    @Test
    void usuarioDesconocido_failClosed_seBloquea() throws Exception {
        UserService userService = mock(UserService.class);
        when(userService.findById(anyLong())).thenReturn(null); // findById vacío
        ProductOperationalModeWsInterceptor interceptor =
                new ProductOperationalModeWsInterceptor(serviceClientePrelaunchModeloOpen(), jwtResolvingTo(123L), userService);

        MockHttpServletResponse rawResp = new MockHttpServletResponse();
        assertFalse(handshake(interceptor, wsRequest(true), rawResp));
        assertEquals(503, rawResp.getStatus());
    }
}
