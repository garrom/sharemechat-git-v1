package com.sharemechat.affiliate.controller;

import com.sharemechat.affiliate.service.AffiliateCodeService;
import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import com.sharemechat.repository.AffiliateClickEventRepository;
import com.sharemechat.repository.AffiliateCommissionRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.UserService;
import io.nayuki.qrcodegen.QrCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.lang.reflect.Field;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * ADR-049 Subpasada 2A: MockMvc de {@code GET /api/models/me/affiliate/qr.svg}.
 * Cubre 200 con SVG valido + headers, 404 sin codigo, 401 sin auth. Tambien
 * un smoke unitario del renderer {@link AffiliateModelController#renderQrToSvg}.
 */
class AffiliateModelControllerQrTest {

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
    @DisplayName("200 con code activado: Content-Type image/svg+xml, ETag por codigo, Cache-Control public, body <svg> valido")
    void qr_activated_returnsSvg() throws Exception {
        User u = makeUser(1L, "m@x.com", "ABCDEFGHJKMN");
        when(userService.findByEmail("m@x.com")).thenReturn(u);

        MvcResult res = mockMvc.perform(get("/api/models/me/affiliate/qr.svg")
                        .principal(new TestingAuthenticationToken("m@x.com", null)))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.valueOf("image/svg+xml")))
                .andExpect(header().string("ETag", "\"ABCDEFGHJKMN\""))
                .andExpect(header().string("Cache-Control",
                        org.hamcrest.Matchers.containsString("max-age=3600")))
                .andExpect(header().string("Cache-Control",
                        org.hamcrest.Matchers.containsString("public")))
                .andReturn();

        String body = res.getResponse().getContentAsString();
        assertNotNull(body);
        assertTrue(body.startsWith("<?xml"),
                "El SVG debe empezar por declaracion XML: " + body.substring(0, Math.min(40, body.length())));
        assertTrue(body.contains("<svg"), "Debe contener <svg root.");
        assertTrue(body.contains("viewBox=\"0 0"), "Debe declarar viewBox.");
        assertTrue(body.contains("</svg>"), "Debe cerrar </svg>.");
    }

    @Test
    @DisplayName("404 cuando la modelo no ha activado el codigo")
    void qr_notActivated_returns404() throws Exception {
        User u = makeUser(2L, "m@x.com", null);
        when(userService.findByEmail("m@x.com")).thenReturn(u);

        mockMvc.perform(get("/api/models/me/affiliate/qr.svg")
                        .principal(new TestingAuthenticationToken("m@x.com", null)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("code_not_activated"));
    }

    @Test
    @DisplayName("401 sin autenticacion")
    void qr_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/models/me/affiliate/qr.svg"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Renderer directo: renderQrToSvg produce un SVG bien formado con path unico")
    void renderQrToSvg_directCall_producesWellFormedSvg() {
        QrCode qr = QrCode.encodeText("https://test.sharemechat.com/i?ref=ABCDEFGHJKMN",
                QrCode.Ecc.MEDIUM);
        String svg = AffiliateModelController.renderQrToSvg(qr, 2);
        assertTrue(svg.startsWith("<?xml"));
        assertTrue(svg.contains("<svg"));
        assertTrue(svg.contains("shape-rendering=\"crispEdges\""),
                "Renderer optimizado para pixel arte: crispEdges obligatorio.");
        assertTrue(svg.contains("<path d=\""), "Debe emitir un <path> unico con todos los modulos.");
        assertTrue(svg.contains("</svg>"));
        // viewBox debe incluir 2*border en cada dimension.
        int size = qr.size + 4;
        assertTrue(svg.contains("viewBox=\"0 0 " + size + " " + size + "\""));
    }
}
