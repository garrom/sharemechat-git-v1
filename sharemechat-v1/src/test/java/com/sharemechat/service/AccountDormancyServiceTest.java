package com.sharemechat.service;

import com.sharemechat.config.AccountDormancyProperties;
import com.sharemechat.constants.Constants;
import com.sharemechat.entity.User;
import com.sharemechat.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Politica cuentas dormidas (2026-07-23). Verifica:
 * <ul>
 *   <li>recordActivity: sella lastActivityAt, auto-reactivate si dormant.</li>
 *   <li>markDormantBatch: honra property enabled, respeta cutoff.</li>
 *   <li>reactivate: admin manual.</li>
 * </ul>
 */
class AccountDormancyServiceTest {

    private UserRepository userRepository;
    private AccountDormancyProperties props;
    private AccountDormancyService service;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        props = new AccountDormancyProperties();
        props.setEnabled(true);
        props.setDormancyDays(180);
        service = new AccountDormancyService(userRepository, props);
    }

    private User newUser(Long id) {
        User u = new User();
        u.setId(id);
        u.setEmail("u" + id + "@test.local");
        u.setRole(Constants.Roles.USER);
        u.setIsActive(true);
        u.setAccountStatus(Constants.AccountStatuses.ACTIVE);
        return u;
    }

    // ---------------------------------------------------------------
    // recordActivity
    // ---------------------------------------------------------------

    @Test
    @DisplayName("recordActivity sella lastActivityAt en user activa (sin dormant)")
    void recordActivity_sellaTimestamp() {
        User u = newUser(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(u));

        service.recordActivity(1L);

        assertNotNull(u.getLastActivityAt());
        assertTrue(u.getIsActive());
        assertNull(u.getDormantSince());
        verify(userRepository).save(u);
    }

    @Test
    @DisplayName("recordActivity auto-reactivate: dormant -> active, limpia dormantSince")
    void recordActivity_autoReactivateDormant() {
        User u = newUser(2L);
        u.setIsActive(false);
        u.setDormantSince(LocalDateTime.now(ZoneOffset.UTC).minusDays(1));
        when(userRepository.findById(2L)).thenReturn(Optional.of(u));

        service.recordActivity(2L);

        assertNotNull(u.getLastActivityAt());
        assertTrue(u.getIsActive());
        assertNull(u.getDormantSince());
        verify(userRepository).save(u);
    }

    @Test
    @DisplayName("recordActivity con userId null es no-op")
    void recordActivity_userIdNull_noOp() {
        service.recordActivity(null);
        verify(userRepository, never()).findById(any());
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("recordActivity con userId inexistente es no-op silencioso")
    void recordActivity_userNotFound_noOp() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());
        service.recordActivity(99L);
        verify(userRepository, never()).save(any());
    }

    // ---------------------------------------------------------------
    // markDormantBatch
    // ---------------------------------------------------------------

    @Test
    @DisplayName("markDormantBatch marca cuentas candidates: isActive=false + dormantSince=NOW")
    void markDormantBatch_marcaCandidatos() {
        User u1 = newUser(10L);
        u1.setLastActivityAt(LocalDateTime.now(ZoneOffset.UTC).minusDays(200));
        User u2 = newUser(11L);
        u2.setLastActivityAt(LocalDateTime.now(ZoneOffset.UTC).minusDays(220));

        when(userRepository.findDormancyCandidates(
                any(LocalDateTime.class),
                eq(Constants.AccountStatuses.ACTIVE),
                eq(500)))
                .thenReturn(List.of(u1, u2));

        int marked = service.markDormantBatch(500);

        assertEquals(2, marked);
        assertFalse(u1.getIsActive());
        assertFalse(u2.getIsActive());
        assertNotNull(u1.getDormantSince());
        assertNotNull(u2.getDormantSince());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<User>> captor = ArgumentCaptor.forClass(List.class);
        verify(userRepository).saveAll(captor.capture());
        assertEquals(2, captor.getValue().size());
    }

    @Test
    @DisplayName("markDormantBatch con enabled=false skip inmediato")
    void markDormantBatch_disabled_skip() {
        props.setEnabled(false);
        int marked = service.markDormantBatch(500);
        assertEquals(0, marked);
        verify(userRepository, never()).findDormancyCandidates(any(), any(), anyInt());
        verify(userRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("markDormantBatch sin candidates devuelve 0 sin saveAll")
    void markDormantBatch_sinCandidates() {
        when(userRepository.findDormancyCandidates(
                any(LocalDateTime.class),
                eq(Constants.AccountStatuses.ACTIVE),
                anyInt()))
                .thenReturn(Collections.emptyList());
        int marked = service.markDormantBatch(500);
        assertEquals(0, marked);
        verify(userRepository, never()).saveAll(any());
    }

    // ---------------------------------------------------------------
    // reactivate
    // ---------------------------------------------------------------

    @Test
    @DisplayName("reactivate admin: dormant -> active, limpia dormantSince, sella lastActivityAt")
    void reactivate_dormant_ok() {
        User u = newUser(20L);
        u.setIsActive(false);
        u.setDormantSince(LocalDateTime.now(ZoneOffset.UTC).minusDays(5));
        when(userRepository.findById(20L)).thenReturn(Optional.of(u));

        service.reactivate(20L);

        assertTrue(u.getIsActive());
        assertNull(u.getDormantSince());
        assertNotNull(u.getLastActivityAt());
        verify(userRepository).save(u);
    }

    @Test
    @DisplayName("reactivate no-op si user no estaba dormant")
    void reactivate_noOpSiNoDormant() {
        User u = newUser(21L);
        u.setIsActive(true);
        when(userRepository.findById(21L)).thenReturn(Optional.of(u));

        service.reactivate(21L);

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("reactivate lanza IllegalArgumentException con userId null")
    void reactivate_userIdNull_throws() {
        assertThrows(IllegalArgumentException.class,
                () -> service.reactivate(null));
    }

    @Test
    @DisplayName("reactivate lanza IllegalArgumentException si user no existe")
    void reactivate_userNotFound_throws() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());
        assertThrows(IllegalArgumentException.class,
                () -> service.reactivate(99L));
    }
}
