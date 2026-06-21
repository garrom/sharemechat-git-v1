package com.sharemechat.streammoderation.service;

import com.sharemechat.config.ModerationFailureProperties;
import com.sharemechat.config.ModerationSamplingProperties;
import com.sharemechat.constants.Constants;
import com.sharemechat.entity.StreamRecord;
import com.sharemechat.service.StreamService;
import com.sharemechat.streammoderation.entity.StreamModerationSession;
import com.sharemechat.streammoderation.repository.StreamModerationSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
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
 * Tests del orquestador del ciclo de vida de sesiones de moderacion (P1.2).
 *
 * Cubre startForStream, stopForStream, markDegraded y cutDegradedSessions
 * incluyendo idempotencia y fail-closed-soft (ADR-036 bloque 3).
 */
class StreamModerationSessionServiceTest {

    private StreamModerationSessionRepository repo;
    private StreamModerationProviderConfigService configService;
    private ModerationSamplingProperties samplingProps;
    private ModerationFailureProperties failureProps;
    private MockModerationClient mockClient;
    private StreamService streamService;
    private StreamModerationSessionService svc;

    @BeforeEach
    void setUp() {
        repo = mock(StreamModerationSessionRepository.class);
        configService = mock(StreamModerationProviderConfigService.class);
        samplingProps = new ModerationSamplingProperties();
        samplingProps.setCadenceSeconds(15);
        failureProps = new ModerationFailureProperties();
        failureProps.setDegradedThresholdMinutes(2);
        failureProps.setCutThresholdMinutes(5);
        mockClient = new MockModerationClient();
        streamService = mock(StreamService.class);
        svc = new StreamModerationSessionService(
                repo, configService, samplingProps, failureProps, mockClient, streamService);
    }

    @Test
    @DisplayName("startForStream: si no existe, crea ACTIVE con provider activo + cadencia + INTERVAL")
    void startForStream_createNew() {
        when(repo.findByStreamRecordId(123L)).thenReturn(Optional.empty());
        when(configService.getActiveMode()).thenReturn(Constants.StreamModerationProvider.MOCK);
        when(repo.save(any(StreamModerationSession.class))).thenAnswer(inv -> inv.getArgument(0));

        StreamModerationSession created = svc.startForStream(123L);

        ArgumentCaptor<StreamModerationSession> captor = ArgumentCaptor.forClass(StreamModerationSession.class);
        verify(repo).save(captor.capture());
        StreamModerationSession saved = captor.getValue();

        assertEquals(Long.valueOf(123L), saved.getStreamRecordId());
        assertEquals(Constants.StreamModerationProvider.MOCK, saved.getProvider());
        assertEquals(Constants.StreamModerationSessionStatus.ACTIVE, saved.getStatus());
        assertEquals(15, saved.getSamplingCadenceSeconds());
        assertEquals(Constants.StreamModerationSamplingStrategy.INTERVAL, saved.getSamplingStrategy());
        assertSame(saved, created);
    }

    @Test
    @DisplayName("startForStream: si ya existe sesion para el stream, devuelve la existente sin crear duplicado")
    void startForStream_idempotent() {
        StreamModerationSession existing = new StreamModerationSession();
        existing.setStreamRecordId(123L);
        existing.setStatus(Constants.StreamModerationSessionStatus.ACTIVE);
        when(repo.findByStreamRecordId(123L)).thenReturn(Optional.of(existing));

        StreamModerationSession got = svc.startForStream(123L);

        verify(repo, never()).save(any(StreamModerationSession.class));
        assertSame(existing, got);
    }

    @Test
    @DisplayName("stopForStream: ACTIVE -> STOPPED + stopped_at")
    void stopForStream_marksStopped() {
        StreamModerationSession existing = new StreamModerationSession();
        existing.setStreamRecordId(456L);
        existing.setStatus(Constants.StreamModerationSessionStatus.ACTIVE);
        when(repo.findByStreamRecordId(456L)).thenReturn(Optional.of(existing));

        svc.stopForStream(456L, "STREAM_ENDED");

        assertEquals(Constants.StreamModerationSessionStatus.STOPPED, existing.getStatus());
        assertNotNull(existing.getStoppedAt());
        verify(repo).save(existing);
    }

    @Test
    @DisplayName("stopForStream: ya STOPPED -> no-op (idempotente)")
    void stopForStream_alreadyStopped_noOp() {
        StreamModerationSession existing = new StreamModerationSession();
        existing.setStreamRecordId(456L);
        existing.setStatus(Constants.StreamModerationSessionStatus.STOPPED);
        when(repo.findByStreamRecordId(456L)).thenReturn(Optional.of(existing));

        svc.stopForStream(456L, "STREAM_ENDED");

        verify(repo, never()).save(any(StreamModerationSession.class));
    }

    @Test
    @DisplayName("stopForStream: no existe -> no-op silencioso")
    void stopForStream_missing_noOp() {
        when(repo.findByStreamRecordId(999L)).thenReturn(Optional.empty());

        svc.stopForStream(999L, "STREAM_ENDED");

        verify(repo, never()).save(any(StreamModerationSession.class));
    }

    @Test
    @DisplayName("markDegraded: cambia status y fija degradedSince si era null")
    void markDegraded_setsTimestamp() {
        StreamModerationSession s = new StreamModerationSession();
        s.setStreamRecordId(10L);
        s.setStatus(Constants.StreamModerationSessionStatus.ACTIVE);
        s.setDegradedSince(null);
        when(repo.findById(77L)).thenReturn(Optional.of(s));

        svc.markDegraded(77L);

        assertEquals(Constants.StreamModerationSessionStatus.DEGRADED, s.getStatus());
        assertNotNull(s.getDegradedSince());
        verify(repo).save(s);
    }

    @Test
    @DisplayName("markDegraded: ya DEGRADED -> no-op")
    void markDegraded_alreadyDegraded_noOp() {
        StreamModerationSession s = new StreamModerationSession();
        s.setStatus(Constants.StreamModerationSessionStatus.DEGRADED);
        when(repo.findById(77L)).thenReturn(Optional.of(s));

        svc.markDegraded(77L);

        verify(repo, never()).save(any(StreamModerationSession.class));
    }

    @Test
    @DisplayName("cutDegradedSessions: lista vacia -> return 0 sin invocar streamService")
    void cutDegraded_empty() {
        when(repo.findByStatusAndDegradedSinceBefore(
                eq(Constants.StreamModerationSessionStatus.DEGRADED), any(LocalDateTime.class)))
                .thenReturn(List.of());

        int cut = svc.cutDegradedSessions(5);

        assertEquals(0, cut);
        verify(streamService, never()).killStreamAsAdmin(anyLong(), anyString());
    }

    @Test
    @DisplayName("cutDegradedSessions: 2 stale -> killStreamAsAdmin invocado 2 veces y return 2")
    void cutDegraded_twoStale() {
        StreamModerationSession a = new StreamModerationSession();
        a.setStreamRecordId(100L);
        a.setProvider(Constants.StreamModerationProvider.MOCK);
        StreamModerationSession b = new StreamModerationSession();
        b.setStreamRecordId(200L);
        b.setProvider(Constants.StreamModerationProvider.MOCK);
        when(repo.findByStatusAndDegradedSinceBefore(
                eq(Constants.StreamModerationSessionStatus.DEGRADED), any(LocalDateTime.class)))
                .thenReturn(List.of(a, b));
        when(streamService.killStreamAsAdmin(anyLong(), anyString())).thenReturn(new StreamRecord());

        int cut = svc.cutDegradedSessions(5);

        assertEquals(2, cut);
        verify(streamService, times(1)).killStreamAsAdmin(eq(100L),
                eq("MODERATION_DEGRADED_CUT:" + Constants.StreamModerationProvider.MOCK));
        verify(streamService, times(1)).killStreamAsAdmin(eq(200L),
                eq("MODERATION_DEGRADED_CUT:" + Constants.StreamModerationProvider.MOCK));
    }

    @Test
    @DisplayName("cutDegradedSessions: una falla, el bucle continua con la siguiente")
    void cutDegraded_oneFails_loopContinues() {
        StreamModerationSession a = new StreamModerationSession();
        a.setStreamRecordId(100L);
        a.setProvider(Constants.StreamModerationProvider.MOCK);
        StreamModerationSession b = new StreamModerationSession();
        b.setStreamRecordId(200L);
        b.setProvider(Constants.StreamModerationProvider.MOCK);
        when(repo.findByStatusAndDegradedSinceBefore(
                eq(Constants.StreamModerationSessionStatus.DEGRADED), any(LocalDateTime.class)))
                .thenReturn(List.of(a, b));
        when(streamService.killStreamAsAdmin(eq(100L), anyString()))
                .thenThrow(new RuntimeException("simulated"));
        when(streamService.killStreamAsAdmin(eq(200L), anyString())).thenReturn(new StreamRecord());

        int cut = svc.cutDegradedSessions(5);

        assertEquals(1, cut, "Solo la segunda sesion se corta con exito");
    }

    @Test
    @DisplayName("getActiveSession: ACTIVE -> Optional.of; STOPPED -> Optional.empty")
    void getActiveSession_filtersStopped() {
        StreamModerationSession active = new StreamModerationSession();
        active.setStreamRecordId(1L);
        active.setStatus(Constants.StreamModerationSessionStatus.ACTIVE);
        when(repo.findByStreamRecordId(1L)).thenReturn(Optional.of(active));

        Optional<StreamModerationSession> got = svc.getActiveSession(1L);
        assertEquals(true, got.isPresent());

        active.setStatus(Constants.StreamModerationSessionStatus.STOPPED);
        Optional<StreamModerationSession> notActive = svc.getActiveSession(1L);
        assertEquals(false, notActive.isPresent());
    }
}
