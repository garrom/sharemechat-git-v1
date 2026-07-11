package com.sharemechat.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sharemechat.constants.Constants;
import com.sharemechat.entity.AffiliateClickEvent;
import com.sharemechat.entity.User;
import com.sharemechat.repository.AffiliateClickEventRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.AffiliateHashService;
import com.sharemechat.service.AffiliateLinkTokenService;
import com.sharemechat.service.ApiRateLimitService;
import com.sharemechat.service.EmailCopyRenderer;
import com.sharemechat.service.EmailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.lang.reflect.Field;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * ADR-049 Subpasada 2B: MockMvc de {@link AffiliatePublicController}.
 * Cubre los 3 endpoints publicos con happy path + guards clave (D15
 * silent skip, D17 invalidacion no verificable aqui — vive en service test).
 */
class AffiliatePublicControllerTest {

    private UserRepository userRepository;
    private AffiliateClickEventRepository clickEventRepository;
    private AffiliateLinkTokenService linkTokenService;
    private AffiliateHashService hashService;
    private EmailService emailService;
    private EmailCopyRenderer emailCopyRenderer;
    private ApiRateLimitService rateLimitService;
    private MockMvc mockMvc;
    private final ObjectMapper json = new ObjectMapper();

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        clickEventRepository = mock(AffiliateClickEventRepository.class);
        linkTokenService = mock(AffiliateLinkTokenService.class);
        hashService = mock(AffiliateHashService.class);
        emailService = mock(EmailService.class);
        emailCopyRenderer = mock(EmailCopyRenderer.class);
        rateLimitService = mock(ApiRateLimitService.class);
        when(hashService.hashTruncated(any())).thenReturn("ab12ab12ab12ab12");
        when(emailCopyRenderer.renderReferralMagicLink(any(), any(), any(), anyInt(), any()))
                .thenReturn(new EmailCopyRenderer.EmailContent("Subject", "<p>body</p>"));

        AffiliatePublicController controller = new AffiliatePublicController(
                userRepository, clickEventRepository, linkTokenService,
                hashService, emailService, emailCopyRenderer, rateLimitService,
                "sharemechat_affiliate_ref", 90, 72, "https://test.sharemechat.com/");
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    // Helper: se llama con matchers estaticos; requiere alias local.
    private static int anyInt() {
        return org.mockito.ArgumentMatchers.anyInt();
    }

    private User makeModel(Long id, String code, String verification, String account) {
        User u = new User();
        u.setEmail("m@x.com");
        u.setRole(Constants.Roles.MODEL);
        u.setVerificationStatus(verification);
        u.setAccountStatus(account);
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
    @DisplayName("POST /click happy: 204 + cookie sharemechat_affiliate_ref con codigo + evento CLICK")
    void click_happy() throws Exception {
        User model = makeModel(97L, "ABCDEFGHJKMN",
                Constants.VerificationStatuses.APPROVED, Constants.AccountStatuses.ACTIVE);
        when(userRepository.findByReferralCodeOwner("ABCDEFGHJKMN")).thenReturn(Optional.of(model));

        String body = json.writeValueAsString(Map.of("code", "ABCDEFGHJKMN"));
        mockMvc.perform(post("/api/public/affiliate/click")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isNoContent())
                .andExpect(cookie().value("sharemechat_affiliate_ref", "ABCDEFGHJKMN"));

        ArgumentCaptor<AffiliateClickEvent> evtCap = ArgumentCaptor.forClass(AffiliateClickEvent.class);
        verify(clickEventRepository, times(1)).save(evtCap.capture());
        assertEquals("CLICK", evtCap.getValue().getEventType());
        assertEquals(97L, evtCap.getValue().getModelUserId());
    }

    @Test
    @DisplayName("POST /click D15: codigo no existe → 204 sin cookie ni evento")
    void click_invalidCode_silentSkip() throws Exception {
        when(userRepository.findByReferralCodeOwner(any())).thenReturn(Optional.empty());

        String body = json.writeValueAsString(Map.of("code", "ZZZZZZZZZZZZ"));
        mockMvc.perform(post("/api/public/affiliate/click")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isNoContent())
                .andExpect(cookie().doesNotExist("sharemechat_affiliate_ref"));

        verify(clickEventRepository, never()).save(any());
    }

    @Test
    @DisplayName("POST /magic-link happy: 204 + email enviado + evento EMAIL_SUBMITTED")
    void magicLink_happy() throws Exception {
        User model = makeModel(97L, "ABCDEFGHJKMN",
                Constants.VerificationStatuses.APPROVED, Constants.AccountStatuses.ACTIVE);
        when(userRepository.findByReferralCodeOwner("ABCDEFGHJKMN")).thenReturn(Optional.of(model));
        when(linkTokenService.generate(97L, "visitor@x.com")).thenReturn("plain-token-xyz");

        String body = json.writeValueAsString(Map.of("code", "ABCDEFGHJKMN", "email", "visitor@x.com"));
        mockMvc.perform(post("/api/public/affiliate/magic-link")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isNoContent());

        verify(rateLimitService, times(1)).checkAffiliateMagicLinkIp(any());
        verify(emailService, times(1)).send(any());
        ArgumentCaptor<AffiliateClickEvent> evtCap = ArgumentCaptor.forClass(AffiliateClickEvent.class);
        verify(clickEventRepository, times(1)).save(evtCap.capture());
        assertEquals("EMAIL_SUBMITTED", evtCap.getValue().getEventType());
    }

    @Test
    @DisplayName("GET /link/consume happy: 302 con Location a /register/client?ref=... + cookie + evento LINK_CONSUMED")
    void consume_happy() throws Exception {
        User model = makeModel(97L, "ABCDEFGHJKMN",
                Constants.VerificationStatuses.APPROVED, Constants.AccountStatuses.ACTIVE);
        when(linkTokenService.consume("plain-token"))
                .thenReturn(new AffiliateLinkTokenService.ConsumeResult(97L, "visitor@x.com"));
        when(userRepository.findById(97L)).thenReturn(Optional.of(model));

        mockMvc.perform(get("/api/public/affiliate/link/consume").param("token", "plain-token"))
                .andExpect(status().isFound())
                .andExpect(header().string("Location",
                        org.hamcrest.Matchers.containsString("/register/client?ref=ABCDEFGHJKMN")))
                .andExpect(cookie().value("sharemechat_affiliate_ref", "ABCDEFGHJKMN"));

        ArgumentCaptor<AffiliateClickEvent> evtCap = ArgumentCaptor.forClass(AffiliateClickEvent.class);
        verify(clickEventRepository, times(1)).save(evtCap.capture());
        assertEquals("LINK_CONSUMED", evtCap.getValue().getEventType());
    }

    @Test
    @DisplayName("GET /link/consume: token expirado → 410 Gone")
    void consume_expired() throws Exception {
        when(linkTokenService.consume(any()))
                .thenThrow(new IllegalStateException(AffiliateLinkTokenService.ERR_TOKEN_EXPIRED));

        mockMvc.perform(get("/api/public/affiliate/link/consume").param("token", "any-token"))
                .andExpect(status().isGone());
    }
}
