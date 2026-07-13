package com.sharemechat.service;

import com.sharemechat.config.LivenessProperties;
import com.sharemechat.constants.Constants;
import com.sharemechat.dto.FaceAttributesResult;
import com.sharemechat.entity.LivenessAttempt;
import com.sharemechat.repository.LivenessAttemptRepository;
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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * ADR-050 Fase B: unit tests de {@link LivenessChallengeService}.
 *
 * <p>Cubre startChallenge (idempotencia con pass vigente, cooldown D6,
 * expira PENDINGs viejos), verify (frames insuficientes, modo MOCK,
 * reglas D4 por tipo, fail-closed-soft D5, no face detected, deadline
 * expired), y hasCurrentPass.
 */
class LivenessChallengeServiceTest {

    private LivenessAttemptRepository repository;
    private LivenessFaceAttributesProvider provider;
    private LivenessProperties props;
    private LivenessChallengeService service;

    private static final Long USER_ID = 42L;

    @BeforeEach
    void setUp() {
        repository = mock(LivenessAttemptRepository.class);
        provider = mock(LivenessFaceAttributesProvider.class);
        props = new LivenessProperties();
        // Default: modo real activado con umbrales por defecto.
        props.setEnabled(true);
        props.setFramesRequired(3);
        props.setTtlSeconds(86_400L);
        props.setTtlVendorUnavailableSeconds(300L);
        props.setMaxFailedAttemptsPerDay(3);
        props.setPendingTtlSeconds(120L);

        when(repository.save(any(LivenessAttempt.class)))
                .thenAnswer(inv -> {
                    LivenessAttempt in = inv.getArgument(0);
                    if (in.getId() == null) {
                        // Simular AUTO_INCREMENT
                        try {
                            java.lang.reflect.Field idField = LivenessAttempt.class.getDeclaredField("id");
                            idField.setAccessible(true);
                            idField.set(in, 1L);
                        } catch (Exception ex) {
                            throw new IllegalStateException(ex);
                        }
                    }
                    return in;
                });

        service = new LivenessChallengeService(repository, provider, props);
    }

    // =====================================================
    // hasCurrentPass
    // =====================================================

    @Test
    @DisplayName("hasCurrentPass devuelve empty si userId es null")
    void hasCurrentPass_nullUser() {
        assertTrue(service.hasCurrentPass(null).isEmpty());
    }

    @Test
    @DisplayName("hasCurrentPass delega en repository con nowUtc")
    void hasCurrentPass_delegates() {
        LivenessAttempt row = attemptWithStatus(Constants.LivenessChallengeStatus.PASSED);
        row.setPassedUntil(LocalDateTime.now(ZoneOffset.UTC).plusHours(12));
        when(repository.findValidPassedByUserId(eq(USER_ID), any(LocalDateTime.class)))
                .thenReturn(Optional.of(row));

        Optional<LivenessAttempt> result = service.hasCurrentPass(USER_ID);
        assertTrue(result.isPresent());
        assertEquals(Constants.LivenessChallengeStatus.PASSED, result.get().getStatus());
    }

    // =====================================================
    // startChallenge
    // =====================================================

    @Test
    @DisplayName("startChallenge con pass vigente → devuelve el existente sin crear nuevo")
    void startChallenge_hasPass_returnsExisting() {
        LivenessAttempt existing = attemptWithStatus(Constants.LivenessChallengeStatus.PASSED);
        existing.setPassedUntil(LocalDateTime.now(ZoneOffset.UTC).plusHours(6));
        when(repository.findValidPassedByUserId(eq(USER_ID), any(LocalDateTime.class)))
                .thenReturn(Optional.of(existing));

        LivenessAttempt result = service.startChallenge(USER_ID);
        assertEquals(Constants.LivenessChallengeStatus.PASSED, result.getStatus());
        // Nunca crea fila nueva
        verify(repository, never()).save(any(LivenessAttempt.class));
    }

    @Test
    @DisplayName("startChallenge en cooldown D6 → lanza cooldown_active")
    void startChallenge_cooldown_throws() {
        when(repository.findValidPassedByUserId(eq(USER_ID), any(LocalDateTime.class)))
                .thenReturn(Optional.empty());
        when(repository.countFailedByUserSince(eq(USER_ID), any(LocalDateTime.class)))
                .thenReturn(3L);

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> service.startChallenge(USER_ID));
        assertEquals("cooldown_active", ex.getMessage());
        verify(repository, never()).save(any(LivenessAttempt.class));
    }

    @Test
    @DisplayName("startChallenge marca PENDINGs viejos como EXPIRED antes de crear nueva fila")
    void startChallenge_expiresStalePendings() {
        when(repository.findValidPassedByUserId(eq(USER_ID), any(LocalDateTime.class)))
                .thenReturn(Optional.empty());
        when(repository.countFailedByUserSince(eq(USER_ID), any(LocalDateTime.class)))
                .thenReturn(0L);
        LivenessAttempt stale = attemptWithStatus(Constants.LivenessChallengeStatus.PENDING);
        when(repository.findByUserIdAndStatus(USER_ID, Constants.LivenessChallengeStatus.PENDING))
                .thenReturn(List.of(stale));

        service.startChallenge(USER_ID);
        // Stale marcada como EXPIRED + nueva fila PENDING → 2 saves
        ArgumentCaptor<LivenessAttempt> captor = ArgumentCaptor.forClass(LivenessAttempt.class);
        verify(repository, times(2)).save(captor.capture());
        List<LivenessAttempt> saved = captor.getAllValues();
        assertEquals(Constants.LivenessChallengeStatus.EXPIRED, saved.get(0).getStatus());
        assertNotNull(saved.get(0).getResolvedAt());
        assertEquals(Constants.LivenessChallengeStatus.PENDING, saved.get(1).getStatus());
    }

    @Test
    @DisplayName("startChallenge crea fila PENDING con challenge type del catalogo D4")
    void startChallenge_createsPending() {
        when(repository.findValidPassedByUserId(eq(USER_ID), any(LocalDateTime.class)))
                .thenReturn(Optional.empty());
        when(repository.countFailedByUserSince(eq(USER_ID), any(LocalDateTime.class)))
                .thenReturn(0L);
        when(repository.findByUserIdAndStatus(USER_ID, Constants.LivenessChallengeStatus.PENDING))
                .thenReturn(Collections.emptyList());

        LivenessAttempt result = service.startChallenge(USER_ID);
        assertEquals(USER_ID, result.getUserId());
        assertEquals(Constants.LivenessChallengeStatus.PENDING, result.getStatus());
        assertTrue(List.of(
                Constants.LivenessChallengeType.BLINK,
                Constants.LivenessChallengeType.TURN_LEFT,
                Constants.LivenessChallengeType.TURN_RIGHT,
                Constants.LivenessChallengeType.SMILE
        ).contains(result.getChallengeType()));
        assertEquals(result.getChallengeType() + "_PROMPT", result.getPromptLc());
    }

    // =====================================================
    // verify - errores de contrato
    // =====================================================

    @Test
    @DisplayName("verify con challengeId inexistente → challenge_not_found")
    void verify_notFound() {
        when(repository.findById(999L)).thenReturn(Optional.empty());
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> service.verify(USER_ID, 999L, List.of(new byte[10])));
        assertEquals("challenge_not_found", ex.getMessage());
    }

    @Test
    @DisplayName("verify con user distinto al owner → challenge_owner_mismatch")
    void verify_ownerMismatch() {
        LivenessAttempt row = attemptWithStatus(Constants.LivenessChallengeStatus.PENDING);
        row.setUserId(999L);
        when(repository.findById(1L)).thenReturn(Optional.of(row));
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> service.verify(USER_ID, 1L, List.of(new byte[10])));
        assertEquals("challenge_owner_mismatch", ex.getMessage());
    }

    @Test
    @DisplayName("verify sobre fila NO PENDING → challenge_not_pending")
    void verify_notPending() {
        LivenessAttempt row = attemptWithStatus(Constants.LivenessChallengeStatus.PASSED);
        when(repository.findById(1L)).thenReturn(Optional.of(row));
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> service.verify(USER_ID, 1L, List.of(new byte[10])));
        assertEquals("challenge_not_pending", ex.getMessage());
    }

    // =====================================================
    // verify - deadline y frames insuficientes
    // =====================================================

    @Test
    @DisplayName("verify con created_at + pendingTtl < now → EXPIRED sin llamar al provider")
    void verify_deadlineExpired() {
        LivenessAttempt row = attemptWithStatus(Constants.LivenessChallengeStatus.PENDING);
        row.setCreatedAt(LocalDateTime.now(ZoneOffset.UTC).minusHours(1));
        when(repository.findById(1L)).thenReturn(Optional.of(row));

        LivenessAttempt result = service.verify(USER_ID, 1L,
                List.of(new byte[10], new byte[10], new byte[10]));
        assertEquals(Constants.LivenessChallengeStatus.EXPIRED, result.getStatus());
        verify(provider, never()).analyze(any());
    }

    @Test
    @DisplayName("verify con frames < required → FAILED sin llamar al provider")
    void verify_framesInsufficient() {
        LivenessAttempt row = attemptWithStatus(Constants.LivenessChallengeStatus.PENDING);
        row.setChallengeType(Constants.LivenessChallengeType.BLINK);
        row.setCreatedAt(LocalDateTime.now(ZoneOffset.UTC));
        when(repository.findById(1L)).thenReturn(Optional.of(row));

        LivenessAttempt result = service.verify(USER_ID, 1L, List.of(new byte[10]));
        assertEquals(Constants.LivenessChallengeStatus.FAILED, result.getStatus());
        assertTrue(result.getSightengineVerdict().contains("frames_insufficient"));
        verify(provider, never()).analyze(any());
    }

    // =====================================================
    // verify - modo MOCK
    // =====================================================

    @Test
    @DisplayName("verify en modo MOCK (enabled=false) → PASSED con TTL completo")
    void verify_mockMode() {
        props.setEnabled(false);
        LivenessAttempt row = attemptWithStatus(Constants.LivenessChallengeStatus.PENDING);
        row.setChallengeType(Constants.LivenessChallengeType.BLINK);
        row.setCreatedAt(LocalDateTime.now(ZoneOffset.UTC));
        when(repository.findById(1L)).thenReturn(Optional.of(row));

        LivenessAttempt result = service.verify(USER_ID, 1L,
                List.of(new byte[10], new byte[10], new byte[10]));
        assertEquals(Constants.LivenessChallengeStatus.PASSED, result.getStatus());
        assertTrue(result.getSightengineVerdict().contains("mock"));
        assertNotNull(result.getPassedUntil());
        verify(provider, never()).analyze(any());
    }

    // =====================================================
    // verify - fail-closed-soft D5
    // =====================================================

    @Test
    @DisplayName("verify con provider throwing → PASSED con vendor_unavailable + TTL corto")
    void verify_vendorUnavailable() {
        LivenessAttempt row = attemptWithStatus(Constants.LivenessChallengeStatus.PENDING);
        row.setChallengeType(Constants.LivenessChallengeType.BLINK);
        row.setCreatedAt(LocalDateTime.now(ZoneOffset.UTC));
        when(repository.findById(1L)).thenReturn(Optional.of(row));
        when(provider.analyze(any())).thenThrow(new RuntimeException("SightEngine 503"));

        LivenessAttempt result = service.verify(USER_ID, 1L,
                List.of(new byte[10], new byte[10], new byte[10]));
        assertEquals(Constants.LivenessChallengeStatus.PASSED, result.getStatus());
        assertTrue(result.getSightengineVerdict().contains("vendor_unavailable"));
        assertNotNull(result.getPassedUntil());
    }

    // =====================================================
    // verify - reglas D4 por tipo
    // =====================================================

    @Test
    @DisplayName("BLINK con eyes_closed variando > umbrales → PASSED")
    void verify_blinkPass() {
        LivenessAttempt row = pendingOfType(Constants.LivenessChallengeType.BLINK);
        when(repository.findById(1L)).thenReturn(Optional.of(row));
        // frame1 ojos abiertos (0.1), frame2 cerrados (0.9), frame3 abiertos (0.1)
        when(provider.analyze(any()))
                .thenReturn(faceResult(0.0, 0.1, 0.0))
                .thenReturn(faceResult(0.0, 0.9, 0.0))
                .thenReturn(faceResult(0.0, 0.1, 0.0));

        LivenessAttempt result = service.verify(USER_ID, 1L, threeFrames());
        assertEquals(Constants.LivenessChallengeStatus.PASSED, result.getStatus());
    }

    @Test
    @DisplayName("BLINK con eyes_closed constante → FAILED (no reaccion)")
    void verify_blinkFail() {
        LivenessAttempt row = pendingOfType(Constants.LivenessChallengeType.BLINK);
        when(repository.findById(1L)).thenReturn(Optional.of(row));
        when(provider.analyze(any())).thenReturn(faceResult(0.0, 0.1, 0.0));

        LivenessAttempt result = service.verify(USER_ID, 1L, threeFrames());
        assertEquals(Constants.LivenessChallengeStatus.FAILED, result.getStatus());
    }

    @Test
    @DisplayName("TURN_LEFT con yaw variando -30° → PASSED")
    void verify_turnLeftPass() {
        LivenessAttempt row = pendingOfType(Constants.LivenessChallengeType.TURN_LEFT);
        when(repository.findById(1L)).thenReturn(Optional.of(row));
        when(provider.analyze(any()))
                .thenReturn(faceResult(0.0, 0.0, 0.0))
                .thenReturn(faceResult(0.0, 0.0, -15.0))
                .thenReturn(faceResult(0.0, 0.0, -30.0));

        LivenessAttempt result = service.verify(USER_ID, 1L, threeFrames());
        assertEquals(Constants.LivenessChallengeStatus.PASSED, result.getStatus());
    }

    @Test
    @DisplayName("TURN_LEFT sin giro suficiente → FAILED")
    void verify_turnLeftFail() {
        LivenessAttempt row = pendingOfType(Constants.LivenessChallengeType.TURN_LEFT);
        when(repository.findById(1L)).thenReturn(Optional.of(row));
        when(provider.analyze(any())).thenReturn(faceResult(0.0, 0.0, 0.0));

        LivenessAttempt result = service.verify(USER_ID, 1L, threeFrames());
        assertEquals(Constants.LivenessChallengeStatus.FAILED, result.getStatus());
    }

    @Test
    @DisplayName("TURN_RIGHT con yaw variando +30° → PASSED")
    void verify_turnRightPass() {
        LivenessAttempt row = pendingOfType(Constants.LivenessChallengeType.TURN_RIGHT);
        when(repository.findById(1L)).thenReturn(Optional.of(row));
        when(provider.analyze(any()))
                .thenReturn(faceResult(0.0, 0.0, 0.0))
                .thenReturn(faceResult(0.0, 0.0, 15.0))
                .thenReturn(faceResult(0.0, 0.0, 30.0));

        LivenessAttempt result = service.verify(USER_ID, 1L, threeFrames());
        assertEquals(Constants.LivenessChallengeStatus.PASSED, result.getStatus());
    }

    @Test
    @DisplayName("SMILE con score transicionando 0.1→0.8 → PASSED")
    void verify_smilePass() {
        LivenessAttempt row = pendingOfType(Constants.LivenessChallengeType.SMILE);
        when(repository.findById(1L)).thenReturn(Optional.of(row));
        when(provider.analyze(any()))
                .thenReturn(faceResult(0.1, 0.0, 0.0))
                .thenReturn(faceResult(0.5, 0.0, 0.0))
                .thenReturn(faceResult(0.8, 0.0, 0.0));

        LivenessAttempt result = service.verify(USER_ID, 1L, threeFrames());
        assertEquals(Constants.LivenessChallengeStatus.PASSED, result.getStatus());
    }

    @Test
    @DisplayName("cualquier frame sin cara detectada → FAILED con reason=no_face_in_all_frames")
    void verify_noFace() {
        LivenessAttempt row = pendingOfType(Constants.LivenessChallengeType.BLINK);
        when(repository.findById(1L)).thenReturn(Optional.of(row));
        when(provider.analyze(any()))
                .thenReturn(faceResult(0.0, 0.9, 0.0))
                .thenReturn(new FaceAttributesResult(false, 0.0, 0.0, 0.0, "{}"))
                .thenReturn(faceResult(0.0, 0.1, 0.0));

        LivenessAttempt result = service.verify(USER_ID, 1L, threeFrames());
        assertEquals(Constants.LivenessChallengeStatus.FAILED, result.getStatus());
        assertTrue(result.getSightengineVerdict().contains("no_face_in_all_frames"));
    }

    // =====================================================
    // Helpers
    // =====================================================

    private static LivenessAttempt attemptWithStatus(String status) {
        LivenessAttempt row = new LivenessAttempt();
        try {
            java.lang.reflect.Field idField = LivenessAttempt.class.getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(row, 1L);
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
        row.setUserId(USER_ID);
        row.setChallengeType(Constants.LivenessChallengeType.BLINK);
        row.setPromptLc(Constants.LivenessChallengeType.BLINK + "_PROMPT");
        row.setStatus(status);
        row.setCreatedAt(LocalDateTime.now(ZoneOffset.UTC));
        return row;
    }

    private static LivenessAttempt pendingOfType(String type) {
        LivenessAttempt row = attemptWithStatus(Constants.LivenessChallengeStatus.PENDING);
        row.setChallengeType(type);
        row.setPromptLc(type + "_PROMPT");
        return row;
    }

    private static FaceAttributesResult faceResult(double smile, double eyesClosed, double yaw) {
        return new FaceAttributesResult(true, smile, eyesClosed, yaw, "{}");
    }

    private static List<byte[]> threeFrames() {
        return List.of(new byte[]{1}, new byte[]{2}, new byte[]{3});
    }
}
