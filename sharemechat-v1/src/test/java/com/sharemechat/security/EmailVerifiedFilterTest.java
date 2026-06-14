package com.sharemechat.security;

import com.sharemechat.entity.User;
import com.sharemechat.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests del EmailVerifiedFilter (frente "Email verification gate total"
 * 2026-06-15). Cubre whitelist, rechazo 403, paso transparente para users
 * verificados, anonimos y backoffice.
 */
class EmailVerifiedFilterTest {

    private UserRepository userRepository;
    private EmailVerifiedFilter filter;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        filter = new EmailVerifiedFilter(userRepository);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private static User userWithEmailVerifiedAt(LocalDateTime verifiedAt) {
        User u = new User();
        u.setEmail("alice@example.com");
        u.setEmailVerifiedAt(verifiedAt);
        return u;
    }

    private void authenticate(String email, String... roles) {
        List<SimpleGrantedAuthority> authorities = List.of(roles).stream()
                .map(SimpleGrantedAuthority::new)
                .toList();
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(email, null, authorities);
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private MockHttpServletRequest req(String method, String path) {
        MockHttpServletRequest r = new MockHttpServletRequest(method, path);
        r.setRequestURI(path);
        return r;
    }

    // -------------------- Bloqueo: user no verificado, path no whitelisted

    @Test
    @DisplayName("user no verificado + path no whitelisted -> 403 EMAIL_NOT_VERIFIED")
    void blocksUnverifiedUserOnNonWhitelistedPath() throws Exception {
        authenticate("alice@example.com", "ROLE_USER");
        when(userRepository.findByEmail("alice@example.com"))
                .thenReturn(Optional.of(userWithEmailVerifiedAt(null)));

        MockHttpServletResponse resp = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req("POST", "/api/transactions/add-balance"), resp, chain);

        assertEquals(403, resp.getStatus());
        assertTrue(resp.getContentType() != null && resp.getContentType().startsWith("application/json"),
                "content-type debe empezar por application/json, fue: " + resp.getContentType());
        String body = resp.getContentAsString();
        assertTrue(body.contains("\"code\":\"EMAIL_NOT_VERIFIED\""), "body debe incluir code: " + body);
        assertTrue(body.contains("\"status\":\"403\""), "body debe incluir status: " + body);
        assertTrue(body.contains("\"path\":\"/api/transactions/add-balance\""), "body debe incluir path: " + body);
        verify(chain, never()).doFilter(any(), any());
    }

    // -------------------- Paso: user verificado, path no whitelisted

    @Test
    @DisplayName("user verificado + path no whitelisted -> pasa al siguiente filter")
    void allowsVerifiedUserOnNonWhitelistedPath() throws Exception {
        authenticate("alice@example.com", "ROLE_CLIENT");
        when(userRepository.findByEmail("alice@example.com"))
                .thenReturn(Optional.of(userWithEmailVerifiedAt(LocalDateTime.now().minusDays(1))));

        MockHttpServletResponse resp = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req("POST", "/api/transactions/add-balance"), resp, chain);

        assertNotEquals(403, resp.getStatus());
        verify(chain, times(1)).doFilter(any(), any());
    }

    // -------------------- Whitelist: paths principales

    @Test
    @DisplayName("path /api/users/me -> pasa aunque email no verificado")
    void whitelist_usersMe() throws Exception {
        authenticate("alice@example.com", "ROLE_USER");
        when(userRepository.findByEmail("alice@example.com"))
                .thenReturn(Optional.of(userWithEmailVerifiedAt(null)));

        MockHttpServletResponse resp = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req("GET", "/api/users/me"), resp, chain);

        assertNotEquals(403, resp.getStatus());
        verify(chain, times(1)).doFilter(any(), any());
    }

    @Test
    @DisplayName("path /api/email-verification/resend -> pasa aunque email no verificado")
    void whitelist_emailVerificationResend() throws Exception {
        authenticate("alice@example.com", "ROLE_USER");
        when(userRepository.findByEmail(any()))
                .thenReturn(Optional.of(userWithEmailVerifiedAt(null)));

        MockHttpServletResponse resp = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req("POST", "/api/email-verification/resend"), resp, chain);

        assertNotEquals(403, resp.getStatus());
        verify(chain, times(1)).doFilter(any(), any());
    }

    @Test
    @DisplayName("path /api/email-verification/confirm -> pasa aunque email no verificado")
    void whitelist_emailVerificationConfirm() throws Exception {
        authenticate("alice@example.com", "ROLE_USER");
        when(userRepository.findByEmail(any()))
                .thenReturn(Optional.of(userWithEmailVerifiedAt(null)));

        MockHttpServletResponse resp = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req("GET", "/api/email-verification/confirm?token=abc"), resp, chain);

        assertNotEquals(403, resp.getStatus());
        verify(chain, times(1)).doFilter(any(), any());
    }

    @Test
    @DisplayName("path /api/auth/logout -> pasa")
    void whitelist_authLogout() throws Exception {
        authenticate("alice@example.com", "ROLE_USER");
        when(userRepository.findByEmail(any()))
                .thenReturn(Optional.of(userWithEmailVerifiedAt(null)));

        MockHttpServletResponse resp = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req("POST", "/api/auth/logout"), resp, chain);

        assertNotEquals(403, resp.getStatus());
        verify(chain, times(1)).doFilter(any(), any());
    }

    @Test
    @DisplayName("path /api/auth/refresh -> pasa")
    void whitelist_authRefresh() throws Exception {
        authenticate("alice@example.com", "ROLE_USER");
        when(userRepository.findByEmail(any()))
                .thenReturn(Optional.of(userWithEmailVerifiedAt(null)));

        MockHttpServletResponse resp = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req("POST", "/api/auth/refresh"), resp, chain);

        assertNotEquals(403, resp.getStatus());
        verify(chain, times(1)).doFilter(any(), any());
    }

    @Test
    @DisplayName("path /api/consent/age-gate matchea wildcard /api/consent/** -> pasa")
    void whitelist_consentWildcard() throws Exception {
        authenticate("alice@example.com", "ROLE_USER");
        when(userRepository.findByEmail(any()))
                .thenReturn(Optional.of(userWithEmailVerifiedAt(null)));

        MockHttpServletResponse resp = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req("POST", "/api/consent/age-gate"), resp, chain);

        assertNotEquals(403, resp.getStatus());
        verify(chain, times(1)).doFilter(any(), any());
    }

    // -------------------- Sin autenticación

    @Test
    @DisplayName("sin autenticación -> pasa (no es problema del filter)")
    void unauthenticated_passes() throws Exception {
        // sin authenticate(): SecurityContext esta vacio.
        MockHttpServletResponse resp = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req("POST", "/api/transactions/add-balance"), resp, chain);

        assertNotEquals(403, resp.getStatus());
        verify(chain, times(1)).doFilter(any(), any());
        verify(userRepository, never()).findByEmail(any());
    }

    @Test
    @DisplayName("OPTIONS (CORS preflight) -> pasa")
    void optionsRequest_passes() throws Exception {
        authenticate("alice@example.com", "ROLE_USER");
        when(userRepository.findByEmail(any()))
                .thenReturn(Optional.of(userWithEmailVerifiedAt(null)));

        MockHttpServletResponse resp = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req("OPTIONS", "/api/transactions/add-balance"), resp, chain);

        assertNotEquals(403, resp.getStatus());
        verify(chain, times(1)).doFilter(any(), any());
    }

    // -------------------- Backoffice excluido del gate

    @Test
    @DisplayName("ROLE_ADMIN -> pasa aunque email no verificado (backoffice fuera del gate)")
    void backoffice_admin_passes() throws Exception {
        authenticate("admin@example.com", "ROLE_ADMIN");
        // Ni siquiera deberia llamar a userRepository: backoffice salta antes
        when(userRepository.findByEmail(any()))
                .thenReturn(Optional.of(userWithEmailVerifiedAt(null)));

        MockHttpServletResponse resp = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req("GET", "/api/admin/models"), resp, chain);

        assertNotEquals(403, resp.getStatus());
        verify(chain, times(1)).doFilter(any(), any());
    }

    // -------------------- Path no whitelisted con user inexistente

    @Test
    @DisplayName("user no existe en BD -> 403 (defensa)")
    void userMissingInDb_blocks() throws Exception {
        authenticate("ghost@example.com", "ROLE_USER");
        when(userRepository.findByEmail("ghost@example.com"))
                .thenReturn(Optional.empty());

        MockHttpServletResponse resp = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req("POST", "/api/transactions/add-balance"), resp, chain);

        assertEquals(403, resp.getStatus());
        verify(chain, never()).doFilter(any(), any());
    }
}
