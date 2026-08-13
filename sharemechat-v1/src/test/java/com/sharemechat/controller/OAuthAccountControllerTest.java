package com.sharemechat.controller;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.sharemechat.dto.OAuthLinkRequestDTO;
import com.sharemechat.dto.SetInitialPasswordRequest;
import com.sharemechat.entity.OAuthAccount;
import com.sharemechat.entity.User;
import com.sharemechat.repository.OAuthAccountRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.GoogleIdTokenVerifierService;
import com.sharemechat.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * ADR-059 / ADR-058: tests del account-linking OAuth ({@link OAuthAccountController}):
 * link / unlink / set-initial-password del user autenticado. Lógica embebida en el
 * controller pero con superficie pequeña (sin el pipeline de invitado del login
 * federado), así que se prueba como UNIT test Mockito directo (los métodos toman
 * {@code Authentication}). Cubre la seguridad sensible del linking y del tema
 * "password NULL" (Google-only): no vincular un sub ya usado por otro user, no
 * desvincular sin password (perdería acceso), y set-initial-password solo si NULL.
 *
 * <p>El verificador del id_token de Google ({@link GoogleIdTokenVerifierService}) se
 * mockea (borde de red/JWKS).
 */
class OAuthAccountControllerTest {

    private UserRepository userRepository;
    private OAuthAccountRepository oauthRepository;
    private GoogleIdTokenVerifierService googleVerifier;
    private UserService userService;
    private PasswordEncoder passwordEncoder;
    private OAuthAccountController controller;

    private static final String EMAIL = "user@example.com";

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        oauthRepository = mock(OAuthAccountRepository.class);
        googleVerifier = mock(GoogleIdTokenVerifierService.class);
        userService = mock(UserService.class);
        passwordEncoder = mock(PasswordEncoder.class);
        controller = new OAuthAccountController(
                userRepository, oauthRepository, googleVerifier, userService, passwordEncoder);
    }

    private User user(Long id, String password) {
        User u = new User();
        u.setId(id);
        u.setEmail(EMAIL);
        u.setPassword(password);
        u.setRole(com.sharemechat.constants.Constants.Roles.CLIENT);
        return u;
    }

    private Authentication auth(User u) {
        Authentication a = mock(Authentication.class);
        when(a.getName()).thenReturn(EMAIL);
        when(userService.findByEmail(EMAIL)).thenReturn(u);
        return a;
    }

    private GoogleIdToken.Payload payload(String sub, String email, boolean verified) {
        GoogleIdToken.Payload p = new GoogleIdToken.Payload();
        p.setSubject(sub);
        p.setEmail(email);
        p.setEmailVerified(verified);
        return p;
    }

    private OAuthLinkRequestDTO linkDto(String token) {
        OAuthLinkRequestDTO d = new OAuthLinkRequestDTO();
        d.setIdToken(token);
        return d;
    }

    private static String code(ResponseEntity<?> resp) {
        Object body = resp.getBody();
        return body instanceof Map ? String.valueOf(((Map<?, ?>) body).get("code")) : null;
    }

    // ---------------- linkGoogle ----------------

    @Test
    void linkGoogle_happy_guarda_el_link() {
        User u = user(1L, "hashed");
        Authentication a = auth(u);
        when(googleVerifier.isConfigured()).thenReturn(true);
        when(oauthRepository.existsByUserIdAndProviderAndRevokedAtIsNull(1L, "google")).thenReturn(false);
        when(googleVerifier.verify("tok")).thenReturn(payload("sub-1", EMAIL, true));
        when(oauthRepository.findByProviderAndProviderUserId("google", "sub-1")).thenReturn(Optional.empty());

        ResponseEntity<?> resp = controller.linkGoogle(linkDto("tok"), a);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(oauthRepository).save(any(OAuthAccount.class));
    }

    @Test
    void linkGoogle_ya_vinculado_devuelve_409() {
        User u = user(1L, "hashed");
        Authentication a = auth(u);
        when(googleVerifier.isConfigured()).thenReturn(true);
        when(oauthRepository.existsByUserIdAndProviderAndRevokedAtIsNull(1L, "google")).thenReturn(true);

        ResponseEntity<?> resp = controller.linkGoogle(linkDto("tok"), a);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(code(resp)).isEqualTo("ALREADY_LINKED");
        verify(oauthRepository, never()).save(any());
    }

    @Test
    void linkGoogle_token_invalido_devuelve_401() {
        User u = user(1L, "hashed");
        Authentication a = auth(u);
        when(googleVerifier.isConfigured()).thenReturn(true);
        when(oauthRepository.existsByUserIdAndProviderAndRevokedAtIsNull(1L, "google")).thenReturn(false);
        when(googleVerifier.verify("tok")).thenReturn(null);

        ResponseEntity<?> resp = controller.linkGoogle(linkDto("tok"), a);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verify(oauthRepository, never()).save(any());
    }

    @Test
    void linkGoogle_sub_de_otro_user_devuelve_409() {
        User u = user(1L, "hashed");
        Authentication a = auth(u);
        when(googleVerifier.isConfigured()).thenReturn(true);
        when(oauthRepository.existsByUserIdAndProviderAndRevokedAtIsNull(1L, "google")).thenReturn(false);
        when(googleVerifier.verify("tok")).thenReturn(payload("sub-1", EMAIL, true));
        OAuthAccount otro = new OAuthAccount();
        otro.setUserId(99L); // pertenece a OTRO user
        otro.setProvider("google");
        otro.setProviderUserId("sub-1");
        when(oauthRepository.findByProviderAndProviderUserId("google", "sub-1")).thenReturn(Optional.of(otro));

        ResponseEntity<?> resp = controller.linkGoogle(linkDto("tok"), a);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(code(resp)).isEqualTo("SUB_ALREADY_LINKED_TO_OTHER_USER");
        verify(oauthRepository, never()).save(any());
    }

    // ---------------- unlinkGoogle ----------------

    @Test
    void unlinkGoogle_sin_password_devuelve_409() {
        User u = user(1L, null); // Google-only, sin password
        Authentication a = auth(u);

        ResponseEntity<?> resp = controller.unlinkGoogle(a);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(code(resp)).isEqualTo("NEEDS_PASSWORD_FIRST");
        verify(oauthRepository, never()).save(any());
    }

    @Test
    void unlinkGoogle_happy_revoca_el_link() {
        User u = user(1L, "hashed");
        Authentication a = auth(u);
        OAuthAccount link = new OAuthAccount();
        link.setUserId(1L);
        link.setProvider("google");
        link.setProviderUserId("sub-1");
        when(oauthRepository.findByUserIdAndRevokedAtIsNull(1L)).thenReturn(List.of(link));

        ResponseEntity<?> resp = controller.unlinkGoogle(a);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(link.getRevokedAt()).isNotNull(); // revocado
        verify(oauthRepository).save(link);
    }

    // ---------------- setInitialPassword ----------------

    @Test
    void setInitialPassword_ya_tiene_password_devuelve_409() {
        User u = user(1L, "hashed"); // ya tiene password
        Authentication a = auth(u);
        SetInitialPasswordRequest body = new SetInitialPasswordRequest();
        body.setNewPassword("una-password-larga");

        ResponseEntity<?> resp = controller.setInitialPassword(body, a);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(code(resp)).isEqualTo("PASSWORD_ALREADY_SET");
        verify(userService, never()).updatePassword(anyLong(), anyString());
    }

    @Test
    void setInitialPassword_happy_establece_la_password() {
        User u = user(1L, null); // Google-only, sin password
        Authentication a = auth(u);
        SetInitialPasswordRequest body = new SetInitialPasswordRequest();
        body.setNewPassword("una-password-larga");

        ResponseEntity<?> resp = controller.setInitialPassword(body, a);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(userService).updatePassword(eq(1L), eq("una-password-larga"));
    }
}
