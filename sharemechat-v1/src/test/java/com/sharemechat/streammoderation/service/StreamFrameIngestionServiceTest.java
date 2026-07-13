package com.sharemechat.streammoderation.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.streammoderation.dto.ModerationFrameSubmission;
import com.sharemechat.streammoderation.dto.ModerationVerdictResult;
import com.sharemechat.streammoderation.entity.StreamModerationReview;
import com.sharemechat.streammoderation.entity.StreamModerationSession;
import com.sharemechat.streammoderation.repository.StreamModerationReviewRepository;
import com.sharemechat.streammoderation.repository.StreamModerationSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Optional;

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
 * Tests de {@link StreamFrameIngestionService}: orquestacion + politica
 * fail-closed-soft + upload de evidencia condicional.
 */
class StreamFrameIngestionServiceTest {

    private StreamModerationSessionRepository sessionRepo;
    private StreamModerationSessionService sessionService;
    private StreamModerationActionService actionService;
    private StreamModerationReviewRepository reviewRepo;
    private ModerationEvidenceUploader uploader;
    private ModerationProviderClient client;
    private StreamFrameIngestionService svc;

    private StreamModerationSession activeSession;
    private final byte[] frame = new byte[] {1, 2, 3};
    private final Instant ts = Instant.parse("2026-06-25T12:00:00Z");

    @BeforeEach
    void setUp() {
        sessionRepo = mock(StreamModerationSessionRepository.class);
        sessionService = mock(StreamModerationSessionService.class);
        actionService = mock(StreamModerationActionService.class);
        reviewRepo = mock(StreamModerationReviewRepository.class);
        uploader = mock(ModerationEvidenceUploader.class);
        client = mock(ModerationProviderClient.class);

        // ADR-050 Fase C: PresenceCheckProperties con enabled=false por
        // defecto - los tests existentes no dependen de presence.
        com.sharemechat.config.PresenceCheckProperties presenceProps =
                new com.sharemechat.config.PresenceCheckProperties();
        svc = new StreamFrameIngestionService(
                sessionRepo, sessionService, actionService, reviewRepo, uploader, presenceProps);

        activeSession = new StreamModerationSession();
        activeSession.setStreamRecordId(500L);
        activeSession.setProvider(Constants.StreamModerationProvider.SIGHTENGINE);
        activeSession.setStatus(Constants.StreamModerationSessionStatus.ACTIVE);

        when(sessionService.resolveActiveClient()).thenReturn(client);
    }

    private ModerationVerdictResult verdict(String severity, String providerEventId) {
        ModerationVerdictResult v = new ModerationVerdictResult();
        v.setSeverityOverall(severity);
        v.setProviderEventId(providerEventId);
        return v;
    }

    @Test
    @DisplayName("sesion ACTIVE + verdict GREEN -> applyVerdict invocado, uploader NO invocado")
    void greenVerdictNoUpload() {
        when(sessionRepo.findById(1L)).thenReturn(Optional.of(activeSession));
        when(client.submitImage(any(ModerationFrameSubmission.class)))
                .thenReturn(verdict(Constants.StreamModerationSeverity.GREEN, "ev-1"));

        svc.processFrameSync(1L, frame, ts);

        verify(actionService).applyVerdict(eq(activeSession), any(ModerationVerdictResult.class));
        verify(uploader, never()).uploadAsync(anyLong(), any(byte[].class));
        verify(sessionService, never()).markDegraded(anyLong());
    }

    @Test
    @DisplayName("verdict AMBER -> applyVerdict + uploader invocado con reviewId localizado")
    void amberTriggersUpload() {
        when(sessionRepo.findById(1L)).thenReturn(Optional.of(activeSession));
        when(client.submitImage(any(ModerationFrameSubmission.class)))
                .thenReturn(verdict(Constants.StreamModerationSeverity.AMBER, "ev-2"));

        StreamModerationReview r = new StreamModerationReview();
        r.setStreamModerationSessionId(7L);
        // setId via reflection no posible sin un mock setter; trabajamos con un id 0 por defecto
        when(reviewRepo.findByProviderAndProviderEventId(
                Constants.StreamModerationProvider.SIGHTENGINE, "ev-2"))
                .thenReturn(Optional.of(r));

        svc.processFrameSync(1L, frame, ts);

        verify(uploader, times(1)).uploadAsync(eq(r.getId()), eq(frame));
    }

    @Test
    @DisplayName("verdict CRITICAL -> applyVerdict + uploader invocado")
    void criticalTriggersUpload() {
        when(sessionRepo.findById(1L)).thenReturn(Optional.of(activeSession));
        when(client.submitImage(any(ModerationFrameSubmission.class)))
                .thenReturn(verdict(Constants.StreamModerationSeverity.CRITICAL, "ev-3"));

        StreamModerationReview r = new StreamModerationReview();
        when(reviewRepo.findByProviderAndProviderEventId(anyString(), eq("ev-3")))
                .thenReturn(Optional.of(r));

        svc.processFrameSync(1L, frame, ts);

        verify(uploader, times(1)).uploadAsync(any(), eq(frame));
    }

    @Test
    @DisplayName("adapter lanza exception -> sessionService.markDegraded invocado, no applyVerdict")
    void adapterExceptionTriggersDegraded() {
        when(sessionRepo.findById(1L)).thenReturn(Optional.of(activeSession));
        when(client.submitImage(any(ModerationFrameSubmission.class)))
                .thenThrow(new IllegalStateException("Sightengine credentials missing"));

        svc.processFrameSync(1L, frame, ts);

        // session.getId() es null en el setup (entity sin id seteado); markDegraded recibe null pero se invoca.
        verify(sessionService).markDegraded(any());
        verify(actionService, never()).applyVerdict(any(), any());
        verify(uploader, never()).uploadAsync(anyLong(), any(byte[].class));
    }

    @Test
    @DisplayName("sesion STOPPED -> skip silencioso, ni adapter ni action ni uploader invocados")
    void stoppedSessionSkip() {
        activeSession.setStatus(Constants.StreamModerationSessionStatus.STOPPED);
        when(sessionRepo.findById(1L)).thenReturn(Optional.of(activeSession));

        svc.processFrameSync(1L, frame, ts);

        verify(client, never()).submitImage(any());
        verify(actionService, never()).applyVerdict(any(), any());
        verify(uploader, never()).uploadAsync(anyLong(), any(byte[].class));
    }

    @Test
    @DisplayName("sesion DEGRADED -> SI procesa frame (recuperacion automatica al primer verdict OK)")
    void degradedSessionStillProcessed() {
        activeSession.setStatus(Constants.StreamModerationSessionStatus.DEGRADED);
        when(sessionRepo.findById(1L)).thenReturn(Optional.of(activeSession));
        when(client.submitImage(any(ModerationFrameSubmission.class)))
                .thenReturn(verdict(Constants.StreamModerationSeverity.GREEN, "ev-x"));

        svc.processFrameSync(1L, frame, ts);

        verify(client).submitImage(any(ModerationFrameSubmission.class));
        verify(actionService).applyVerdict(any(), any());
    }

    @Test
    @DisplayName("sesion no encontrada -> no-op defensivo")
    void sessionNotFound() {
        when(sessionRepo.findById(1L)).thenReturn(Optional.empty());

        svc.processFrameSync(1L, frame, ts);

        verify(client, never()).submitImage(any());
    }

    @Test
    @DisplayName("verdict AMBER + providerEventId blank -> no se intenta upload")
    void amberWithBlankProviderEventIdNoUpload() {
        when(sessionRepo.findById(1L)).thenReturn(Optional.of(activeSession));
        when(client.submitImage(any(ModerationFrameSubmission.class)))
                .thenReturn(verdict(Constants.StreamModerationSeverity.AMBER, ""));

        svc.processFrameSync(1L, frame, ts);

        verify(uploader, never()).uploadAsync(anyLong(), any(byte[].class));
    }
}
