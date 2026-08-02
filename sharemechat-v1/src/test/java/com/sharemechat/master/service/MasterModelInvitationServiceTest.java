package com.sharemechat.master.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import com.sharemechat.exception.NicknameAlreadyInUseException;
import com.sharemechat.master.dto.CreateMasterModelRequestDTO;
import com.sharemechat.master.repository.MasterModelSplitRepository;
import com.sharemechat.master.repository.MasterRepository;
import com.sharemechat.repository.EmailVerificationTokenRepository;
import com.sharemechat.repository.ModelRepository;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.service.EmailVerificationService;

import java.math.BigDecimal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * ADR-056 S4.5: tests del servicio invitacion Master → modelo. Cubre:
 * flujo happy, idempotencia con mismo Master, rechazo por email de
 * otro Master, activacion con password valida, rechazo activacion sobre
 * user ya activado.
 */
class MasterModelInvitationServiceTest {

    private UserRepository userRepository;
    private ModelRepository modelRepository;
    private EmailVerificationService emailVerificationService;
    private EmailVerificationTokenRepository tokenRepository;
    private PasswordEncoder passwordEncoder;
    private MasterRepository masterRepository;
    private MasterModelSplitRepository splitRepository;
    private MasterModelInvitationService svc;

    @BeforeEach
    void setUp() throws Exception {
        userRepository = mock(UserRepository.class);
        modelRepository = mock(ModelRepository.class);
        emailVerificationService = mock(EmailVerificationService.class);
        tokenRepository = mock(EmailVerificationTokenRepository.class);
        passwordEncoder = mock(PasswordEncoder.class);
        masterRepository = mock(MasterRepository.class);
        splitRepository = mock(MasterModelSplitRepository.class);
        when(passwordEncoder.encode(any())).thenReturn("HASH");

        svc = new MasterModelInvitationService(
                userRepository, modelRepository, emailVerificationService,
                tokenRepository, passwordEncoder, masterRepository, splitRepository);
    }

    @Test
    @DisplayName("inviteModel happy path: crea user + model + emite token")
    void invite_happy() {
        CreateMasterModelRequestDTO dto = new CreateMasterModelRequestDTO();
        dto.setModelEmail("modelo@example.com");
        dto.setModelNickname("estrella01");
        dto.setInitialInternalSharePct(new BigDecimal("20"));

        when(userRepository.findByEmail("modelo@example.com")).thenReturn(Optional.empty());
        when(userRepository.existsByNickname("estrella01")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            java.lang.reflect.Field f = User.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(u, 100L);
            return u;
        });

        Long modelId = svc.inviteModel(500L, dto);
        assertEquals(100L, modelId);
        // Verificar user creado con estado correcto.
        verify(userRepository).save(any(User.class));
        verify(modelRepository).save(any());
        // Split inicial (feedback operador 2026-07-31): obligatorio en la misma
        // transaccion para evitar modelos operando sin pacto registrado.
        verify(splitRepository).save(any());
        verify(emailVerificationService).issueVerification(any(User.class), eq(500L),
                eq("MASTER_MODEL_INVITATION"));
    }

    @Test
    @DisplayName("inviteModel rechaza cuando initialInternalSharePct falta")
    void invite_rejects_missing_share_pct() {
        CreateMasterModelRequestDTO dto = new CreateMasterModelRequestDTO();
        dto.setModelEmail("modelo@example.com");
        dto.setModelNickname("estrella01");
        // Sin setInitialInternalSharePct → null → debe rechazar antes de tocar repos.

        assertThrows(IllegalArgumentException.class, () -> svc.inviteModel(500L, dto));
        verify(userRepository, never()).save(any());
        verify(modelRepository, never()).save(any());
        verify(splitRepository, never()).save(any());
    }

    @Test
    @DisplayName("inviteModel idempotente: mismo Master, mismo email -> reemite token, no duplica user")
    void invite_idempotent_same_master() {
        CreateMasterModelRequestDTO dto = new CreateMasterModelRequestDTO();
        dto.setModelEmail("modelo@example.com");
        dto.setModelNickname("estrella01");
        dto.setInitialInternalSharePct(new BigDecimal("20"));

        User existing = new User();
        try {
            java.lang.reflect.Field f = User.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(existing, 100L);
        } catch (ReflectiveOperationException e) { throw new RuntimeException(e); }
        when(userRepository.findByEmail("modelo@example.com")).thenReturn(Optional.of(existing));
        when(modelRepository.findMasterUserIdByModelUserId(100L)).thenReturn(Optional.of(500L));

        Long modelId = svc.inviteModel(500L, dto);
        assertEquals(100L, modelId);
        // NO debe crearse User nuevo.
        verify(userRepository, never()).save(any());
        // SI debe reemitirse token.
        verify(emailVerificationService, times(1)).issueVerification(eq(existing), eq(500L),
                eq("MASTER_MODEL_INVITATION"));
    }

    @Test
    @DisplayName("inviteModel rechaza email registrado por otro Master")
    void invite_rejects_email_of_other_master() {
        CreateMasterModelRequestDTO dto = new CreateMasterModelRequestDTO();
        dto.setModelEmail("modelo@example.com");
        dto.setModelNickname("estrella01");
        dto.setInitialInternalSharePct(new BigDecimal("20"));

        User existing = new User();
        try {
            java.lang.reflect.Field f = User.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(existing, 100L);
        } catch (ReflectiveOperationException e) { throw new RuntimeException(e); }
        when(userRepository.findByEmail("modelo@example.com")).thenReturn(Optional.of(existing));
        // Modelo pertenece a OTRO master (999).
        when(modelRepository.findMasterUserIdByModelUserId(100L)).thenReturn(Optional.of(999L));

        assertThrows(IllegalArgumentException.class, () -> svc.inviteModel(500L, dto));
    }

    @Test
    @DisplayName("inviteModel rechaza nickname duplicado")
    void invite_rejects_nickname_taken() {
        CreateMasterModelRequestDTO dto = new CreateMasterModelRequestDTO();
        dto.setModelEmail("modelo@example.com");
        dto.setModelNickname("existente");
        // ADR-056 Opción D (commit d21db3b): pacto obligatorio al invitar.
        // Sin este set, el servicio lanza IllegalArgumentException antes
        // de llegar al check de nickname.
        dto.setInitialInternalSharePct(new BigDecimal("20"));
        when(userRepository.findByEmail("modelo@example.com")).thenReturn(Optional.empty());
        when(userRepository.existsByNickname("existente")).thenReturn(true);

        assertThrows(NicknameAlreadyInUseException.class, () -> svc.inviteModel(500L, dto));
    }

    @Test
    @DisplayName("activate happy: consume token + set password + limpia password_temporary")
    void activate_happy() {
        Map<String, Object> tokenResult = new HashMap<>();
        tokenResult.put("userId", 100L);
        when(emailVerificationService.consumeVerificationToken("raw-token")).thenReturn(tokenResult);
        User u = new User();
        u.setEmail("modelo@example.com");
        u.setPasswordTemporary(true);
        try {
            java.lang.reflect.Field f = User.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(u, 100L);
        } catch (ReflectiveOperationException e) { throw new RuntimeException(e); }
        when(userRepository.findById(100L)).thenReturn(Optional.of(u));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        Long userId = svc.activate("raw-token", "PasswordSegura99");
        assertEquals(100L, userId);
        assertNotNull(u.getFirstPasswordChangeAt());
        // password_temporary limpiado
        assertEquals(false, u.isPasswordTemporary());
    }

    @Test
    @DisplayName("activate rechaza reutilizacion: user ya activado (password no temporal)")
    void activate_rejects_reuse() {
        Map<String, Object> tokenResult = new HashMap<>();
        tokenResult.put("userId", 100L);
        when(emailVerificationService.consumeVerificationToken("raw-token")).thenReturn(tokenResult);
        User u = new User();
        u.setPasswordTemporary(false);  // ya activado antes
        try {
            java.lang.reflect.Field f = User.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(u, 100L);
        } catch (ReflectiveOperationException e) { throw new RuntimeException(e); }
        when(userRepository.findById(100L)).thenReturn(Optional.of(u));

        assertThrows(IllegalStateException.class, () -> svc.activate("raw-token", "PasswordSegura99"));
    }

    @Test
    @DisplayName("activate rechaza password corta")
    void activate_rejects_short_password() {
        assertThrows(IllegalArgumentException.class,
                () -> svc.activate("raw-token", "corta"));
    }
}
