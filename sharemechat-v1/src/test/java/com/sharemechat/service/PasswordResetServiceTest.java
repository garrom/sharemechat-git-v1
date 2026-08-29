package com.sharemechat.service;

import com.sharemechat.entity.PasswordResetToken;
import com.sharemechat.entity.User;
import com.sharemechat.repository.PasswordResetTokenRepository;
import com.sharemechat.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Ciclo del token de reset de contraseña: respuesta anti-enumeración,
 * creación de token one-time (hash SHA-256), expiración y consumo one-time.
 */
class PasswordResetServiceTest {

    private final UserRepository userRepo = mock(UserRepository.class);
    private final PasswordResetTokenRepository tokenRepo = mock(PasswordResetTokenRepository.class);
    private final EmailService emailService = mock(EmailService.class);
    private final EmailCopyRenderer copy = mock(EmailCopyRenderer.class);

    private PasswordResetService svc;

    @BeforeEach
    void setUp() {
        svc = new PasswordResetService(userRepo, tokenRepo, emailService, copy);
        ReflectionTestUtils.setField(svc, "ttlMinutes", 30);
        ReflectionTestUtils.setField(svc, "resetUrlBase", "https://app.test/reset");
        EmailCopyRenderer.EmailContent content = mock(EmailCopyRenderer.EmailContent.class);
        when(content.subject()).thenReturn("s");
        when(content.body()).thenReturn("b");
        when(copy.renderPasswordReset(any(), anyString(), anyInt())).thenReturn(content);
    }

    private User user(long id, String email) {
        User u = new User();
        u.setId(id);
        u.setEmail(email);
        return u;
    }

    @Test
    void requestResetConEmailInexistenteNoCreaTokenNiEnviaEmail() {
        when(userRepo.findByEmail("nadie@x.com")).thenReturn(Optional.empty());

        svc.requestReset("nadie@x.com", "1.2.3.4", "ua");

        verify(tokenRepo, never()).save(any());
        verify(emailService, never()).send(any());
    }

    @Test
    void requestResetConEmailValidoCreaTokenEInvalidaElAnterior() {
        User u = user(7L, "bob@x.com");
        when(userRepo.findByEmail("bob@x.com")).thenReturn(Optional.of(u));
        PasswordResetToken prev = new PasswordResetToken();
        prev.setUser(u);
        when(tokenRepo.findTopByUserAndUsedAtIsNullOrderByCreatedAtDesc(u)).thenReturn(Optional.of(prev));

        svc.requestReset("bob@x.com", "1.2.3.4", "ua");

        // el anterior se marca usado + se guarda el nuevo -> 2 saves
        verify(tokenRepo, times(2)).save(any());
        assertThat(prev.getUsedAt()).isNotNull();
        verify(emailService).send(any());
    }

    @Test
    void consumeTokenNuloOVacioLanza() {
        assertThatThrownBy(() -> svc.consumeToken(null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> svc.consumeToken("  ")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void consumeTokenInexistenteOUsadoLanza() {
        when(tokenRepo.findByTokenHashAndUsedAtIsNull(anyString())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> svc.consumeToken("raw-token"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("inválido");
    }

    @Test
    void consumeTokenExpiradoLanza() {
        PasswordResetToken prt = new PasswordResetToken();
        prt.setUser(user(7L, "bob@x.com"));
        prt.setExpiresAt(LocalDateTime.now().minusMinutes(1)); // ya expirado
        when(tokenRepo.findByTokenHashAndUsedAtIsNull(anyString())).thenReturn(Optional.of(prt));

        assertThatThrownBy(() -> svc.consumeToken("raw-token"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("expirado");
        verify(tokenRepo, never()).save(any()); // no se consume un token expirado
    }

    @Test
    void consumeTokenValidoLoMarcaUsadoYDevuelveElUserId() {
        PasswordResetToken prt = new PasswordResetToken();
        prt.setUser(user(42L, "bob@x.com"));
        prt.setExpiresAt(LocalDateTime.now().plusMinutes(10));
        when(tokenRepo.findByTokenHashAndUsedAtIsNull(anyString())).thenReturn(Optional.of(prt));

        Long userId = svc.consumeToken("raw-token");

        assertThat(userId).isEqualTo(42L);
        assertThat(prt.getUsedAt()).as("el token debe quedar consumido (one-time)").isNotNull();
        verify(tokenRepo).save(prt);
    }
}
