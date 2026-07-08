package com.sharemechat.support.controller;

import com.sharemechat.entity.User;
import com.sharemechat.exception.GlobalExceptionHandler;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.UserService;
import com.sharemechat.support.dto.GrantDetailDTO;
import com.sharemechat.support.entity.BackofficeAgentProfile;
import com.sharemechat.support.repository.BackofficeAgentProfileRepository;
import com.sharemechat.support.repository.SupportConversationRepository;
import com.sharemechat.support.repository.SupportMessageRepository;
import com.sharemechat.support.service.BackofficeAgentProfileGrantService;
import com.sharemechat.support.service.BackofficeAgentProfileService;
import com.sharemechat.support.service.SupportHumanHandlingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * MockMvc test del GET /api/admin/support/profiles/{profileId}/grants
 * (frente B.3.2 cierre hueco, ADR-046). Cubre 200 con array y 404 si la
 * profile no existe. El 403 sin permiso se garantiza declarativamente por
 * matcher en SecurityConfig (patrón compartido con el resto del controller
 * admin) y no se ejercita aquí porque el standaloneSetup no monta el
 * filter chain de seguridad.
 */
class SupportAdminControllerListGrantsMockMvcTest {

    private UserService userService;
    private UserRepository userRepository;
    private SupportConversationRepository convRepo;
    private SupportMessageRepository msgRepo;
    private BackofficeAgentProfileRepository profileRepo;
    private BackofficeAgentProfileService profileService;
    private BackofficeAgentProfileGrantService grantService;
    private SupportHumanHandlingService humanHandling;
    private SupportAdminController controller;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        userService = mock(UserService.class);
        userRepository = mock(UserRepository.class);
        convRepo = mock(SupportConversationRepository.class);
        msgRepo = mock(SupportMessageRepository.class);
        profileRepo = mock(BackofficeAgentProfileRepository.class);
        profileService = mock(BackofficeAgentProfileService.class);
        grantService = mock(BackofficeAgentProfileGrantService.class);
        humanHandling = mock(SupportHumanHandlingService.class);

        User admin = new User();
        admin.setEmail("operations+admin@sharemechat.com");
        try {
            java.lang.reflect.Field f = User.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(admin, 9L);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        when(userService.findByEmail("operations+admin@sharemechat.com")).thenReturn(admin);

        controller = new SupportAdminController(
                userService,
                userRepository,
                convRepo,
                msgRepo,
                profileRepo,
                profileService,
                grantService,
                humanHandling
        );
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("GET /profiles/{id}/grants: 200 con array (grants + emails) cuando la profile existe")
    void listGrantsReturnsArray() throws Exception {
        BackofficeAgentProfile p = new BackofficeAgentProfile();
        p.setDisplayName("Test QA");
        when(profileRepo.existsById(1L)).thenReturn(true);

        GrantDetailDTO g1 = new GrantDetailDTO();
        g1.setUserId(10L);
        g1.setUserEmail("u10@example.com");
        g1.setGrantedBy(9L);
        g1.setGrantedByEmail("operations+admin@sharemechat.com");
        g1.setGrantedAt(LocalDateTime.of(2026, 7, 8, 12, 0));
        g1.setActive(true);
        when(grantService.listGrantsByProfileDetailed(eq(1L))).thenReturn(List.of(g1));

        mockMvc.perform(get("/api/admin/support/profiles/1/grants")
                        .principal(new TestingAuthenticationToken(
                                "operations+admin@sharemechat.com", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].userId").value(10))
                .andExpect(jsonPath("$[0].userEmail").value("u10@example.com"))
                .andExpect(jsonPath("$[0].grantedByEmail")
                        .value("operations+admin@sharemechat.com"))
                .andExpect(jsonPath("$[0].active").value(true));
    }

    @Test
    @DisplayName("GET /profiles/{id}/grants: profile inexistente -> 404")
    void listGrantsNotFound() throws Exception {
        when(profileRepo.existsById(999L)).thenReturn(false);

        mockMvc.perform(get("/api/admin/support/profiles/999/grants")
                        .principal(new TestingAuthenticationToken(
                                "operations+admin@sharemechat.com", null)))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("GET /profiles/{id}/grants: profile sin grants -> 200 con array vacio")
    void listGrantsEmpty() throws Exception {
        when(profileRepo.existsById(5L)).thenReturn(true);
        when(grantService.listGrantsByProfileDetailed(eq(5L))).thenReturn(List.of());

        mockMvc.perform(get("/api/admin/support/profiles/5/grants")
                        .principal(new TestingAuthenticationToken(
                                "operations+admin@sharemechat.com", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$").isEmpty());
    }
}
