package com.sharemechat.controller;

import com.sharemechat.dto.LatestKycSessionDTO;
import com.sharemechat.entity.KycSession;
import com.sharemechat.entity.User;
import com.sharemechat.repository.KycSessionRepository;
import com.sharemechat.service.CountryAccessService;
import com.sharemechat.service.KycSessionService;
import com.sharemechat.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Tests sub-frente A (2026-06-20) — GET /api/kyc/sessions/me/latest.
 * Devuelve la última sesión KYC del user autenticado para gate del botón
 * "Iniciar verificación" en DashboardUserModel.
 */
class KycProviderControllerLatestSessionTest {

    private KycSessionService kycSessionService;
    private UserService userService;
    private CountryAccessService countryAccessService;
    private KycSessionRepository kycSessionRepository;
    private KycProviderController controller;

    @BeforeEach
    void setUp() {
        kycSessionService = mock(KycSessionService.class);
        userService = mock(UserService.class);
        countryAccessService = mock(CountryAccessService.class);
        kycSessionRepository = mock(KycSessionRepository.class);
        controller = new KycProviderController(
                kycSessionService, userService, countryAccessService, kycSessionRepository
        );
    }

    private static Authentication authFor(String email) {
        Authentication auth = mock(Authentication.class);
        when(auth.getName()).thenReturn(email);
        return auth;
    }

    private static User userWith(long id, String email) {
        User u = new User();
        u.setId(id);
        u.setEmail(email);
        return u;
    }

    private static KycSession sessionWith(long id, Long userId, String sessionType,
                                          String kycStatus, String providerStatus,
                                          String providerSessionId) {
        KycSession s = new KycSession();
        s.setUserId(userId);
        s.setProvider("DIDIT");
        s.setSessionType(sessionType);
        s.setKycStatus(kycStatus);
        s.setProviderStatus(providerStatus);
        s.setProviderSessionId(providerSessionId);
        // id is identity-generated; tests need it set for equality assertions
        try {
            java.lang.reflect.Field idField = KycSession.class.getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(s, id);
        } catch (Exception ignored) {
            // best-effort for tests
        }
        return s;
    }

    @Test
    @DisplayName("Sin auth (authentication=null) -> 401")
    void unauthenticatedNullAuth() {
        ResponseEntity<LatestKycSessionDTO> resp = controller.latestKycSession(null);
        assertEquals(HttpStatus.UNAUTHORIZED, resp.getStatusCode());
    }

    @Test
    @DisplayName("Auth válido pero user no existe en BD -> 401")
    void authenticatedButUserNotFound() {
        Authentication auth = authFor("ghost@sharemechat.com");
        when(userService.findByEmail("ghost@sharemechat.com")).thenReturn(null);

        ResponseEntity<LatestKycSessionDTO> resp = controller.latestKycSession(auth);
        assertEquals(HttpStatus.UNAUTHORIZED, resp.getStatusCode());
    }

    @Test
    @DisplayName("User sin sesiones KYC -> 204 No Content")
    void userWithoutSessions() {
        Authentication auth = authFor("demo+nosessions@sharemechat.com");
        User user = userWith(50L, "demo+nosessions@sharemechat.com");
        when(userService.findByEmail("demo+nosessions@sharemechat.com")).thenReturn(user);
        when(kycSessionRepository.findTopByUserIdOrderByIdDesc(50L)).thenReturn(Optional.empty());

        ResponseEntity<LatestKycSessionDTO> resp = controller.latestKycSession(auth);
        assertEquals(HttpStatus.NO_CONTENT, resp.getStatusCode());
        assertNull(resp.getBody());
    }

    @Test
    @DisplayName("User con sesión APPROVED -> 200 con la sesión mapeada")
    void userWithApprovedSession() {
        Authentication auth = authFor("demo+approved@sharemechat.com");
        User user = userWith(60L, "demo+approved@sharemechat.com");
        when(userService.findByEmail("demo+approved@sharemechat.com")).thenReturn(user);

        KycSession session = sessionWith(101L, 60L, "MODEL", "APPROVED", "Approved", "didit-sess-101");
        when(kycSessionRepository.findTopByUserIdOrderByIdDesc(60L)).thenReturn(Optional.of(session));

        ResponseEntity<LatestKycSessionDTO> resp = controller.latestKycSession(auth);
        assertEquals(HttpStatus.OK, resp.getStatusCode());
        LatestKycSessionDTO body = resp.getBody();
        assertNotNull(body);
        assertEquals(101L, body.id());
        assertEquals("MODEL", body.sessionType());
        assertEquals("APPROVED", body.kycStatus());
        assertEquals("Approved", body.providerStatus());
        assertEquals("didit-sess-101", body.providerSessionId());
    }

    @Test
    @DisplayName("User con sesión IN_PROGRESS intermedia -> 200 con esa sesión (caso del bug del botón)")
    void userWithInProgressSession() {
        Authentication auth = authFor("demo+inprogress@sharemechat.com");
        User user = userWith(70L, "demo+inprogress@sharemechat.com");
        when(userService.findByEmail("demo+inprogress@sharemechat.com")).thenReturn(user);

        KycSession session = sessionWith(202L, 70L, "MODEL", "PENDING", "In Progress", "didit-sess-202");
        when(kycSessionRepository.findTopByUserIdOrderByIdDesc(70L)).thenReturn(Optional.of(session));

        ResponseEntity<LatestKycSessionDTO> resp = controller.latestKycSession(auth);
        assertEquals(HttpStatus.OK, resp.getStatusCode());
        LatestKycSessionDTO body = resp.getBody();
        assertNotNull(body);
        assertEquals(202L, body.id());
        assertEquals("PENDING", body.kycStatus());
        assertEquals("In Progress", body.providerStatus());
    }
}
