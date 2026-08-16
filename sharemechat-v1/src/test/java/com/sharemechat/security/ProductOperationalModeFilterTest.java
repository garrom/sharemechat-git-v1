package com.sharemechat.security;

import com.sharemechat.config.ProductOperationalProperties;
import com.sharemechat.config.ProductOperationalProperties.Mode;
import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.ProductOperationalModeService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.Collections;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * ADR-059 — cobertura del modo-por-rol en la CAPA REST (ProductOperationalModeFilter,
 * feat(gate) 6af36bf1). Verifica la resolución de {@code isModel} (fuente
 * autoritativa BD, fail-closed) y que la modelo pasa el gate en PRELAUNCH global
 * + modeModel OPEN mientras el cliente se bloquea (503).
 *
 * Test unit puro (Mockito, sin Spring ni Docker): se instancia el filtro con un
 * ProductOperationalModeService real y un UserRepository mockeado; se invoca
 * doFilterInternal (protected, accesible desde el mismo paquete).
 */
class ProductOperationalModeFilterTest {

    private static final String PRODUCT_PATH = "/api/webrtc/config"; // gateado en PRELAUNCH

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    // Servicio real: cliente PRELAUNCH, modelo OPEN (el caso del operador).
    private ProductOperationalModeService serviceClientePrelaunchModeloOpen() {
        ProductOperationalProperties p = new ProductOperationalProperties();
        p.getAccess().setMode(Mode.PRELAUNCH);
        p.getAccess().setModeModel(Mode.OPEN);
        return new ProductOperationalModeService(p);
    }

    private ProductOperationalModeFilter filterWith(ProductOperationalModeService svc, UserRepository repo) {
        return new ProductOperationalModeFilter(svc, mock(JwtUtil.class), "example.com", false, repo);
    }

    private void authenticateAs(String email) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(email, null, Collections.emptyList()));
    }

    private User user(String role, String userType) {
        User u = new User();
        u.setRole(role);
        u.setUserType(userType);
        return u;
    }

    private HttpServletRequest getRequest(String path) {
        HttpServletRequest req = mock(HttpServletRequest.class);
        when(req.getMethod()).thenReturn("GET");
        when(req.getRequestURI()).thenReturn(path);
        return req;
    }

    // ---- casos ----

    @Test
    void modelo_pasaElGate_enPrelaunchGlobalConModeloOpen() throws Exception {
        UserRepository repo = mock(UserRepository.class);
        when(repo.findByEmail("model@x")).thenReturn(Optional.of(user(Constants.Roles.MODEL, null)));
        ProductOperationalModeFilter filter = filterWith(serviceClientePrelaunchModeloOpen(), repo);
        authenticateAs("model@x");

        HttpServletRequest req = getRequest(PRODUCT_PATH);
        HttpServletResponse resp = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);

        filter.doFilterInternal(req, resp, chain);

        verify(chain).doFilter(req, resp);          // permitido
        verify(resp, never()).setStatus(anyIntServiceUnavailable());
    }

    @Test
    void candidataUserFormModel_pasaElGate_igualQueLaModelo() throws Exception {
        UserRepository repo = mock(UserRepository.class);
        when(repo.findByEmail("cand@x"))
                .thenReturn(Optional.of(user(Constants.Roles.USER, Constants.UserTypes.FORM_MODEL)));
        ProductOperationalModeFilter filter = filterWith(serviceClientePrelaunchModeloOpen(), repo);
        authenticateAs("cand@x");

        FilterChain chain = mock(FilterChain.class);
        filter.doFilterInternal(getRequest(PRODUCT_PATH), mock(HttpServletResponse.class), chain);

        verify(chain).doFilter(any(), any());
    }

    @Test
    void cliente_seBloquea_conModeloOpen() throws Exception {
        UserRepository repo = mock(UserRepository.class);
        when(repo.findByEmail("client@x"))
                .thenReturn(Optional.of(user(Constants.Roles.USER, Constants.UserTypes.FORM_CLIENT)));
        ProductOperationalModeFilter filter = filterWith(serviceClientePrelaunchModeloOpen(), repo);
        authenticateAs("client@x");

        HttpServletResponse resp = mock(HttpServletResponse.class);
        when(resp.getWriter()).thenReturn(new PrintWriter(new StringWriter()));
        FilterChain chain = mock(FilterChain.class);

        filter.doFilterInternal(getRequest(PRODUCT_PATH), resp, chain);

        verify(chain, never()).doFilter(any(), any());   // bloqueado
        verify(resp).setStatus(503);
    }

    @Test
    void usuarioDesconocido_failClosed_seTrataComoClienteYSeBloquea() throws Exception {
        // resolveIsModel fail-closed: findByEmail vacío → isModel=false → modo global (PRELAUNCH) → bloqueo.
        UserRepository repo = mock(UserRepository.class);
        when(repo.findByEmail(any())).thenReturn(Optional.empty());
        ProductOperationalModeFilter filter = filterWith(serviceClientePrelaunchModeloOpen(), repo);
        authenticateAs("ghost@x");

        HttpServletResponse resp = mock(HttpServletResponse.class);
        when(resp.getWriter()).thenReturn(new PrintWriter(new StringWriter()));
        FilterChain chain = mock(FilterChain.class);

        filter.doFilterInternal(getRequest(PRODUCT_PATH), resp, chain);

        verify(chain, never()).doFilter(any(), any());
        verify(resp).setStatus(503);
    }

    private static int anyIntServiceUnavailable() {
        return 503;
    }
}
