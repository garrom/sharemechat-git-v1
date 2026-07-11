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
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * ADR-049 Subpasada 2A: MockMvc de {@code GET /api/models/me/affiliate}.
 */
class AffiliateModelControllerDashboardTest {

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
                "https://test.sharemechat.com/");
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
        // Stats vacias por defecto.
        when(clickEventRepository.countByModelUserIdAndEventType(anyLong(), eq("CLICK")))
                .thenReturn(0L);
        when(clickEventRepository.countUniqueVisitorsForModel(anyLong())).thenReturn(0L);
        when(userRepository.countByReferredByUserId(anyLong())).thenReturn(0L);
        when(commissionRepository.sumCommissionAmountByReferrerInStatuses(anyLong(), any()))
                .thenReturn(0L);
    }

    private User makeUser(Long id, String email, String code) {
        User u = new User();
        u.setEmail(email);
        u.setRole(Constants.Roles.MODEL);
        u.setVerificationStatus(Constants.VerificationStatuses.APPROVED);
        u.setAccountStatus(Constants.AccountStatuses.ACTIVE);
        u.setReferralCodeOwner(code);
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
    @DisplayName("Modelo sin codigo: 200 con code=null, active=false, urlCanonical=null, stats a 0")
    void dashboard_notActivated_returnsNullCode() throws Exception {
        User u = makeUser(1L, "m@x.com", null);
        when(userService.findByEmail("m@x.com")).thenReturn(u);

        mockMvc.perform(get("/api/models/me/affiliate")
                        .principal(new TestingAuthenticationToken("m@x.com", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").doesNotExist())
                .andExpect(jsonPath("$.active").value(false))
                .andExpect(jsonPath("$.urlCanonical").doesNotExist())
                .andExpect(jsonPath("$.stats.clicksTotal").value(0))
                .andExpect(jsonPath("$.stats.clicksUniqueVisitors").value(0))
                .andExpect(jsonPath("$.stats.clientsReferred").value(0))
                .andExpect(jsonPath("$.stats.commissionAccruedCents").value(0));
    }

    @Test
    @DisplayName("Modelo con codigo: 200 con code + active=true + urlCanonical bien formada + stats a 0")
    void dashboard_activated_returnsCodeAndUrl() throws Exception {
        User u = makeUser(2L, "m@x.com", "ABCDEFGHJKMN");
        when(userService.findByEmail("m@x.com")).thenReturn(u);

        mockMvc.perform(get("/api/models/me/affiliate")
                        .principal(new TestingAuthenticationToken("m@x.com", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("ABCDEFGHJKMN"))
                .andExpect(jsonPath("$.active").value(true))
                // El controller quita el trailing slash del base-url, asi que
                // el resultado es <base>/i?ref=<code> sin doble slash.
                .andExpect(jsonPath("$.urlCanonical")
                        .value("https://test.sharemechat.com/i?ref=ABCDEFGHJKMN"));
    }

    @Test
    @DisplayName("Stats no cero: valores agregados se propagan al DTO")
    void dashboard_statsPropagate() throws Exception {
        User u = makeUser(3L, "m@x.com", "CODEABCDEFGH");
        when(userService.findByEmail("m@x.com")).thenReturn(u);
        when(clickEventRepository.countByModelUserIdAndEventType(3L, "CLICK")).thenReturn(42L);
        when(clickEventRepository.countUniqueVisitorsForModel(3L)).thenReturn(11L);
        when(userRepository.countByReferredByUserId(3L)).thenReturn(3L);
        when(commissionRepository.sumCommissionAmountByReferrerInStatuses(
                eq(3L), any())).thenReturn(150000L); // 1500,00 EUR en cents

        mockMvc.perform(get("/api/models/me/affiliate")
                        .principal(new TestingAuthenticationToken("m@x.com", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stats.clicksTotal").value(42))
                .andExpect(jsonPath("$.stats.clicksUniqueVisitors").value(11))
                .andExpect(jsonPath("$.stats.clientsReferred").value(3))
                .andExpect(jsonPath("$.stats.commissionAccruedCents").value(150000));
    }

    @Test
    @DisplayName("401 sin autenticacion")
    void dashboard_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/models/me/affiliate"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("unauthenticated"));
    }
}
