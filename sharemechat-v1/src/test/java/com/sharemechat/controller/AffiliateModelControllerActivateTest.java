package com.sharemechat.controller;

import com.sharemechat.service.AffiliateCodeService;
import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import com.sharemechat.repository.AffiliateClickEventRepository;
import com.sharemechat.repository.AffiliateCommissionRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.lang.reflect.Field;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * ADR-049 Subpasada 2A: MockMvc de {@code POST /api/models/me/affiliate/activate}.
 * Setup standalone sin Spring Security (el guard hasRole('MODEL') se valida
 * en SecurityConfig, no en el controller). Los tests verifican el flujo
 * feliz + los codigos de error accionables devueltos por el mapping de
 * IllegalStateException a HTTP.
 */
class AffiliateModelControllerActivateTest {

    private AffiliateCodeService affiliateCodeService;
    private UserService userService;
    private UserRepository userRepository;
    private AffiliateClickEventRepository clickEventRepository;
    private AffiliateCommissionRepository commissionRepository;
    private AffiliateModelController controller;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        affiliateCodeService = mock(AffiliateCodeService.class);
        userService = mock(UserService.class);
        userRepository = mock(UserRepository.class);
        clickEventRepository = mock(AffiliateClickEventRepository.class);
        commissionRepository = mock(AffiliateCommissionRepository.class);
        controller = new AffiliateModelController(
                affiliateCodeService, userService, userRepository,
                clickEventRepository, commissionRepository,
                "https://test.sharemechat.com");
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    private User makeUser(Long id, String email, String role, String verificationStatus,
                          String accountStatus, String existingCode) {
        User u = new User();
        u.setEmail(email);
        u.setRole(role);
        u.setVerificationStatus(verificationStatus);
        u.setAccountStatus(accountStatus);
        u.setReferralCodeOwner(existingCode);
        try {
            Field f = User.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(u, id);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        return u;
    }

    @Test
    @DisplayName("200 primera invocacion: devuelve code + alreadyActivated=false")
    void activate_firstCall_returnsNewCode() throws Exception {
        User u = makeUser(1L, "m@x.com", Constants.Roles.MODEL,
                Constants.VerificationStatuses.APPROVED, Constants.AccountStatuses.ACTIVE, null);
        when(userService.findByEmail("m@x.com")).thenReturn(u);
        when(affiliateCodeService.generateForModel(1L)).thenReturn("ABCDEFGHJKMN");

        mockMvc.perform(post("/api/models/me/affiliate/activate")
                        .principal(new TestingAuthenticationToken("m@x.com", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("ABCDEFGHJKMN"))
                .andExpect(jsonPath("$.alreadyActivated").value(false))
                .andExpect(jsonPath("$.activatedAt").exists());
    }

    @Test
    @DisplayName("200 idempotente: devuelve mismo code + alreadyActivated=true")
    void activate_idempotent_returnsExistingCode() throws Exception {
        User u = makeUser(2L, "m@x.com", Constants.Roles.MODEL,
                Constants.VerificationStatuses.APPROVED, Constants.AccountStatuses.ACTIVE,
                "PREXISTINGCD");
        when(userService.findByEmail("m@x.com")).thenReturn(u);
        when(affiliateCodeService.generateForModel(2L)).thenReturn("PREXISTINGCD");

        mockMvc.perform(post("/api/models/me/affiliate/activate")
                        .principal(new TestingAuthenticationToken("m@x.com", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("PREXISTINGCD"))
                .andExpect(jsonPath("$.alreadyActivated").value(true));
    }

    @Test
    @DisplayName("403 role_required cuando el service lanza ERR_ROLE_REQUIRED")
    void activate_roleRequired_returns403() throws Exception {
        User u = makeUser(3L, "c@x.com", Constants.Roles.CLIENT,
                Constants.VerificationStatuses.APPROVED, Constants.AccountStatuses.ACTIVE, null);
        when(userService.findByEmail("c@x.com")).thenReturn(u);
        when(affiliateCodeService.generateForModel(3L))
                .thenThrow(new IllegalStateException(AffiliateCodeService.ERR_ROLE_REQUIRED));

        mockMvc.perform(post("/api/models/me/affiliate/activate")
                        .principal(new TestingAuthenticationToken("c@x.com", null)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("role_required"));
    }

    @Test
    @DisplayName("403 kyc_required con current_status=PENDING y mensaje accionable")
    void activate_kycRequired_returns403WithStatus() throws Exception {
        User u = makeUser(4L, "m@x.com", Constants.Roles.MODEL,
                Constants.VerificationStatuses.PENDING, Constants.AccountStatuses.ACTIVE, null);
        when(userService.findByEmail("m@x.com")).thenReturn(u);
        when(affiliateCodeService.generateForModel(4L))
                .thenThrow(new IllegalStateException(
                        AffiliateCodeService.ERR_KYC_REQUIRED_PREFIX + "PENDING"));

        mockMvc.perform(post("/api/models/me/affiliate/activate")
                        .principal(new TestingAuthenticationToken("m@x.com", null)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("kyc_required"))
                .andExpect(jsonPath("$.current_status").value("PENDING"))
                .andExpect(jsonPath("$.message",
                        org.hamcrest.Matchers.containsString("Estado actual: PENDING")))
                .andExpect(jsonPath("$.message",
                        org.hamcrest.Matchers.containsString("Completa la verificacion")));
    }

    @Test
    @DisplayName("403 account_suspended cuando la modelo esta suspendida (D8)")
    void activate_suspended_returns403() throws Exception {
        User u = makeUser(5L, "m@x.com", Constants.Roles.MODEL,
                Constants.VerificationStatuses.APPROVED, Constants.AccountStatuses.SUSPENDED, null);
        when(userService.findByEmail("m@x.com")).thenReturn(u);
        when(affiliateCodeService.generateForModel(5L))
                .thenThrow(new IllegalStateException(AffiliateCodeService.ERR_ACCOUNT_SUSPENDED));

        mockMvc.perform(post("/api/models/me/affiliate/activate")
                        .principal(new TestingAuthenticationToken("m@x.com", null)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("account_suspended"));
    }

    @Test
    @DisplayName("503 code_generation_exhausted cuando se agotan reintentos")
    void activate_codeExhausted_returns503() throws Exception {
        User u = makeUser(6L, "m@x.com", Constants.Roles.MODEL,
                Constants.VerificationStatuses.APPROVED, Constants.AccountStatuses.ACTIVE, null);
        when(userService.findByEmail("m@x.com")).thenReturn(u);
        when(affiliateCodeService.generateForModel(6L))
                .thenThrow(new IllegalStateException(AffiliateCodeService.ERR_CODE_EXHAUSTED));

        mockMvc.perform(post("/api/models/me/affiliate/activate")
                        .principal(new TestingAuthenticationToken("m@x.com", null)))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error").value("code_generation_exhausted"));
    }

    @Test
    @DisplayName("401 sin autenticacion (principal null)")
    void activate_unauthenticated_returns401() throws Exception {
        mockMvc.perform(post("/api/models/me/affiliate/activate"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("unauthenticated"));
    }
}
