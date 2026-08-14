package com.sharemechat.controller;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.sharemechat.constants.Constants;
import com.sharemechat.dto.GoogleAuthRequestDTO;
import com.sharemechat.entity.OAuthAccount;
import com.sharemechat.entity.User;
import com.sharemechat.exception.InvalidCredentialsException;
import com.sharemechat.repository.OAuthAccountRepository;
import com.sharemechat.repository.RefreshTokenRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.security.JwtUtil;
import com.sharemechat.service.AccountDormancyService;
import com.sharemechat.service.AgeGatePolicyService;
import com.sharemechat.service.ApiRateLimitService;
import com.sharemechat.service.AuthRiskContext;
import com.sharemechat.service.AuthRiskService;
import com.sharemechat.service.BackofficeAccessService;
import com.sharemechat.service.ConsentService;
import com.sharemechat.service.CountryAccessService;
import com.sharemechat.service.GoogleIdTokenVerifierService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * ADR-059 / ADR-058: tests del LOGIN FEDERADO con Google
 * ({@link AuthGoogleController#googleAuth}). La lógica vive en el controller (12
 * deps + pipeline age-gate/rate-limit/country/risk/backoffice/dormancy/cookies);
 * se prueba instanciando el controller con mocks y pasando
 * {@code MockHttpServletRequest/Response} directamente (unit test, sin MockMvc ni
 * Spring Security — menos frágil y sin tocar producción, opción decidida por el
 * operador). El {@code @BeforeEach} deja el pipeline "happy" montado; cada test
 * rompe lo suyo.
 *
 * <p>Cubre: no configurado→503, age-gate no confirmado→403, id_token inválido→401
 * (excepción), path A usuario ya vinculado→200 login, path B colisión de email sin
 * verificar→409, path C register-client nuevo→crea User CLIENT (password NULL) +
 * 200, intent=login sin cuenta→404.
 */
class AuthGoogleControllerTest {

    private GoogleIdTokenVerifierService googleVerifier;
    private UserRepository userRepository;
    private OAuthAccountRepository oauthRepository;
    private RefreshTokenRepository refreshRepo;
    private JwtUtil jwtUtil;
    private ApiRateLimitService rateLimitService;
    private CountryAccessService countryAccessService;
    private ConsentService consentService;
    private AuthRiskService authRiskService;
    private BackofficeAccessService backofficeAccessService;
    private AccountDormancyService dormancyService;
    private AgeGatePolicyService ageGatePolicyService;

    private AuthGoogleController controller;
    private MockHttpServletRequest req;
    private MockHttpServletResponse res;

    @BeforeEach
    void setUp() {
        googleVerifier = mock(GoogleIdTokenVerifierService.class);
        userRepository = mock(UserRepository.class);
        oauthRepository = mock(OAuthAccountRepository.class);
        refreshRepo = mock(RefreshTokenRepository.class);
        jwtUtil = mock(JwtUtil.class);
        rateLimitService = mock(ApiRateLimitService.class);
        countryAccessService = mock(CountryAccessService.class);
        consentService = mock(ConsentService.class);
        authRiskService = mock(AuthRiskService.class);
        backofficeAccessService = mock(BackofficeAccessService.class);
        dormancyService = mock(AccountDormancyService.class);
        ageGatePolicyService = mock(AgeGatePolicyService.class);

        controller = new AuthGoogleController(
                googleVerifier, userRepository, oauthRepository, refreshRepo, jwtUtil,
                rateLimitService, countryAccessService, consentService, authRiskService,
                backofficeAccessService, dormancyService, ageGatePolicyService);
        ReflectionTestUtils.setField(controller, "cookieDomain", "test.local");
        ReflectionTestUtils.setField(controller, "secureCookies", false);

        // Pipeline "happy" por defecto.
        when(googleVerifier.isConfigured()).thenReturn(true);
        when(consentService.hasGuestAgeGate(any())).thenReturn(true);
        AuthRiskContext ctx = mock(AuthRiskContext.class);
        when(ctx.withUserId(anyLong())).thenReturn(ctx);
        when(authRiskService.buildContext(any(), any(), any(), any(), any())).thenReturn(ctx);
        when(backofficeAccessService.loadProfile(anyLong(), any()))
                .thenReturn(new BackofficeAccessService.BackofficeAccessProfile(Set.of(), Set.of()));
        when(ageGatePolicyService.getCurrentTermsVersion()).thenReturn("v1");
        when(jwtUtil.generateAccessToken(any(), any(), any())).thenReturn("access-jwt");
        when(jwtUtil.generateRefreshToken()).thenReturn("refresh-jwt");

        req = new MockHttpServletRequest();
        req.setCookies(new Cookie("consent_id", "cid-1"));
        res = new MockHttpServletResponse();
    }

    private GoogleAuthRequestDTO dto(String idToken, String intent) {
        GoogleAuthRequestDTO d = new GoogleAuthRequestDTO();
        d.setIdToken(idToken);
        d.setIntent(intent);
        return d;
    }

    private GoogleIdToken.Payload payload(String sub, String email, boolean verified) {
        GoogleIdToken.Payload p = new GoogleIdToken.Payload();
        p.setSubject(sub);
        p.setEmail(email);
        p.setEmailVerified(verified);
        return p;
    }

    private User clientUser(Long id, String email) {
        User u = new User();
        u.setId(id);
        u.setEmail(email);
        u.setRole(Constants.Roles.CLIENT);
        u.setIsActive(true);
        u.setUnsubscribe(false);
        u.setAccountStatus(Constants.AccountStatuses.ACTIVE);
        return u;
    }

    private static String code(ResponseEntity<?> resp) {
        Object body = resp.getBody();
        return body instanceof java.util.Map ? String.valueOf(((java.util.Map<?, ?>) body).get("code")) : null;
    }

    @Test
    void no_configurado_devuelve_503() {
        when(googleVerifier.isConfigured()).thenReturn(false);

        ResponseEntity<?> resp = controller.googleAuth(dto("tok", "login"), "cid-1", req, res);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(code(resp)).isEqualTo("GOOGLE_AUTH_UNAVAILABLE");
    }

    @Test
    void sin_age_gate_devuelve_403() {
        when(consentService.hasGuestAgeGate(any())).thenReturn(false);

        ResponseEntity<?> resp = controller.googleAuth(dto("tok", "login"), "cid-1", req, res);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void id_token_invalido_lanza_InvalidCredentials() {
        when(googleVerifier.verify("tok")).thenReturn(null);

        assertThatThrownBy(() -> controller.googleAuth(dto("tok", "login"), "cid-1", req, res))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void path_A_usuario_vinculado_hace_login_200() {
        when(googleVerifier.verify("tok")).thenReturn(payload("sub-1", "u@example.com", true));
        OAuthAccount link = new OAuthAccount();
        link.setUserId(1L);
        link.setProvider("google");
        link.setProviderUserId("sub-1");
        when(oauthRepository.findByProviderAndProviderUserIdAndRevokedAtIsNull("google", "sub-1"))
                .thenReturn(Optional.of(link));
        when(userRepository.findById(1L)).thenReturn(Optional.of(clientUser(1L, "u@example.com")));

        ResponseEntity<?> resp = controller.googleAuth(dto("tok", "login"), "cid-1", req, res);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(refreshRepo).save(any()); // refresh token emitido = login efectivo
    }

    @Test
    void path_B_email_colision_sin_verificar_devuelve_409() {
        when(googleVerifier.verify("tok")).thenReturn(payload("sub-1", "u@example.com", true));
        when(oauthRepository.findByProviderAndProviderUserIdAndRevokedAtIsNull("google", "sub-1"))
                .thenReturn(Optional.empty());
        User existing = clientUser(2L, "u@example.com");
        existing.setEmailVerifiedAt(null); // el user existente NO había verificado su email
        when(userRepository.findByEmail("u@example.com")).thenReturn(Optional.of(existing));

        ResponseEntity<?> resp = controller.googleAuth(dto("tok", "login"), "cid-1", req, res);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(code(resp)).isEqualTo("EMAIL_COLLISION_NEEDS_PASSWORD");
    }

    @Test
    void path_C_register_client_nuevo_crea_user_CLIENT_sin_password_200() {
        when(googleVerifier.verify("tok")).thenReturn(payload("sub-1", "new@example.com", true));
        when(oauthRepository.findByProviderAndProviderUserIdAndRevokedAtIsNull("google", "sub-1"))
                .thenReturn(Optional.empty());
        when(userRepository.findByEmail("new@example.com")).thenReturn(Optional.empty());
        when(oauthRepository.findByProviderAndProviderUserId("google", "sub-1")).thenReturn(Optional.empty());
        // save asigna id y devuelve el propio user.
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(5L);
            return u;
        });

        ResponseEntity<?> resp = controller.googleAuth(dto("tok", "register-client"), "cid-1", req, res);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        ArgumentCaptor<User> cap = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(cap.capture());
        User created = cap.getValue();
        assertThat(created.getPassword()).isNull(); // Google-only: password NULL
        assertThat(created.getRole()).isEqualTo(Constants.Roles.USER);
        assertThat(created.getUserType()).isEqualTo(Constants.UserTypes.FORM_CLIENT);
    }

    @Test
    void intent_login_sin_cuenta_devuelve_404() {
        when(googleVerifier.verify("tok")).thenReturn(payload("sub-1", "none@example.com", true));
        when(oauthRepository.findByProviderAndProviderUserIdAndRevokedAtIsNull("google", "sub-1"))
                .thenReturn(Optional.empty());
        when(userRepository.findByEmail("none@example.com")).thenReturn(Optional.empty());

        ResponseEntity<?> resp = controller.googleAuth(dto("tok", "login"), "cid-1", req, res);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(code(resp)).isEqualTo("NO_ACCOUNT_FOR_EMAIL");
    }
}
