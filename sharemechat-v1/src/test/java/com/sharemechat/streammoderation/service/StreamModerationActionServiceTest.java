package com.sharemechat.streammoderation.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.StreamRecord;
import com.sharemechat.service.StreamService;
import com.sharemechat.streammoderation.dto.ModerationCategoryVerdict;
import com.sharemechat.streammoderation.dto.ModerationVerdictResult;
import com.sharemechat.streammoderation.entity.StreamModerationEvent;
import com.sharemechat.streammoderation.entity.StreamModerationReview;
import com.sharemechat.streammoderation.entity.StreamModerationSession;
import com.sharemechat.streammoderation.repository.StreamModerationEventRepository;
import com.sharemechat.streammoderation.repository.StreamModerationReviewRepository;
import com.sharemechat.streammoderation.repository.StreamModerationSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests de la tabla de decision del action service (P1.2).
 *
 * GREEN -> no review creada, evento persistido.
 * AMBER -> review priority=100.
 * RED -> review priority=50.
 * CRITICAL -> review priority=10 + killStreamAsAdmin invocado.
 * Idempotencia: providerEventId duplicado -> no-op.
 * providerEventId null -> sintetiza "sync_<UUID>".
 */
class StreamModerationActionServiceTest {

    private StreamModerationEventRepository eventRepo;
    private StreamModerationReviewRepository reviewRepo;
    private StreamModerationSessionRepository sessionRepo;
    private StreamService streamService;
    private StreamModerationActionService svc;

    private StreamModerationSession session;

    @BeforeEach
    void setUp() {
        eventRepo = mock(StreamModerationEventRepository.class);
        reviewRepo = mock(StreamModerationReviewRepository.class);
        sessionRepo = mock(StreamModerationSessionRepository.class);
        streamService = mock(StreamService.class);
        // ADR-050 fix UX 2026-07-15: MatchingHandler + MessagesWsHandler mockeados.
        // Los tests existentes no dependen del auto-cut WS; solo verifican
        // persistencia y triggerAutoCut a nivel BD.
        com.sharemechat.handler.MatchingHandler matchingHandler =
                org.mockito.Mockito.mock(com.sharemechat.handler.MatchingHandler.class);
        com.sharemechat.handler.MessagesWsHandler messagesWsHandler =
                org.mockito.Mockito.mock(com.sharemechat.handler.MessagesWsHandler.class);
        svc = new StreamModerationActionService(eventRepo, reviewRepo, sessionRepo,
                streamService, matchingHandler, messagesWsHandler);

        // Default mock: save devuelve el objeto pasado (Mockito default es null).
        when(reviewRepo.save(any(StreamModerationReview.class))).thenAnswer(inv -> inv.getArgument(0));

        session = new StreamModerationSession();
        session.setStreamRecordId(500L);
        session.setProvider(Constants.StreamModerationProvider.MOCK);
        session.setVerdictsReceived(0);
        // id = null hasta save; aceptable para los tests que no dependen de session.id
    }

    private ModerationVerdictResult verdict(String severity, String providerEventId) {
        ModerationVerdictResult v = new ModerationVerdictResult();
        v.setProviderEventId(providerEventId);
        v.setSeverityOverall(severity);
        v.setVendorMetadataJson("{}");
        v.getCategoryVerdicts().put(
                Constants.StreamModerationCategory.NUDITY,
                new ModerationCategoryVerdict(
                        Constants.StreamModerationCategory.NUDITY,
                        new BigDecimal("95.50"),
                        severity));
        return v;
    }

    @Test
    @DisplayName("GREEN -> evento persistido, contador +1, NO crea review")
    void green_noReviewCreated() {
        when(eventRepo.findByProviderAndProviderEventId(anyString(), anyString())).thenReturn(Optional.empty());

        svc.applyVerdict(session, verdict(Constants.StreamModerationSeverity.GREEN, "ev-green-1"));

        verify(eventRepo, times(1)).save(any(StreamModerationEvent.class));
        verify(reviewRepo, never()).save(any(StreamModerationReview.class));
        verify(streamService, never()).killStreamAsAdmin(anyLong(), anyString());
        assertEquals(1, session.getVerdictsReceived());
    }

    @Test
    @DisplayName("AMBER -> evento + review priority=100")
    void amber_reviewPriority100() {
        when(eventRepo.findByProviderAndProviderEventId(anyString(), anyString())).thenReturn(Optional.empty());

        svc.applyVerdict(session, verdict(Constants.StreamModerationSeverity.AMBER, "ev-amber-1"));

        ArgumentCaptor<StreamModerationReview> captor = ArgumentCaptor.forClass(StreamModerationReview.class);
        verify(reviewRepo).save(captor.capture());
        StreamModerationReview r = captor.getValue();
        assertEquals(100, r.getPriority());
        assertEquals(Constants.StreamModerationSeverity.AMBER, r.getSeverity());
        assertEquals(Constants.StreamModerationReviewStatus.PENDING, r.getStatus());
        verify(streamService, never()).killStreamAsAdmin(anyLong(), anyString());
    }

    @Test
    @DisplayName("RED -> evento + review priority=50")
    void red_reviewPriority50() {
        when(eventRepo.findByProviderAndProviderEventId(anyString(), anyString())).thenReturn(Optional.empty());

        svc.applyVerdict(session, verdict(Constants.StreamModerationSeverity.RED, "ev-red-1"));

        ArgumentCaptor<StreamModerationReview> captor = ArgumentCaptor.forClass(StreamModerationReview.class);
        verify(reviewRepo).save(captor.capture());
        assertEquals(50, captor.getValue().getPriority());
        verify(streamService, never()).killStreamAsAdmin(anyLong(), anyString());
    }

    @Test
    @DisplayName("CRITICAL -> review priority=10 + killStreamAsAdmin con razon MODERATION_AUTO_CUT")
    void critical_reviewAndKill() {
        when(eventRepo.findByProviderAndProviderEventId(anyString(), anyString())).thenReturn(Optional.empty());
        when(streamService.killStreamAsAdmin(anyLong(), anyString())).thenReturn(new StreamRecord());

        svc.applyVerdict(session, verdict(Constants.StreamModerationSeverity.CRITICAL, "ev-critical-1"));

        ArgumentCaptor<StreamModerationReview> revCaptor = ArgumentCaptor.forClass(StreamModerationReview.class);
        verify(reviewRepo).save(revCaptor.capture());
        assertEquals(10, revCaptor.getValue().getPriority());

        ArgumentCaptor<String> reasonCaptor = ArgumentCaptor.forClass(String.class);
        verify(streamService).killStreamAsAdmin(eq(500L), reasonCaptor.capture());
        String reason = reasonCaptor.getValue();
        assertNotNull(reason);
        assertEquals(true, reason.startsWith("MODERATION_AUTO_CUT:"),
                "Esperado prefijo 'MODERATION_AUTO_CUT:', fue: " + reason);
    }

    private static Long eq(long v) {
        return org.mockito.ArgumentMatchers.eq(v);
    }

    @Test
    @DisplayName("Idempotencia: providerEventId duplicado -> no-op (evento existente)")
    void idempotency_duplicateEventIgnored() {
        StreamModerationEvent existing = new StreamModerationEvent();
        when(eventRepo.findByProviderAndProviderEventId(Constants.StreamModerationProvider.MOCK, "ev-dup"))
                .thenReturn(Optional.of(existing));

        svc.applyVerdict(session, verdict(Constants.StreamModerationSeverity.CRITICAL, "ev-dup"));

        verify(eventRepo, never()).save(any(StreamModerationEvent.class));
        verify(reviewRepo, never()).save(any(StreamModerationReview.class));
        verify(streamService, never()).killStreamAsAdmin(anyLong(), anyString());
    }

    @Test
    @DisplayName("providerEventId NULL -> sintetiza 'sync_<UUID>' antes del check")
    void nullProviderEventId_synthSyncPrefix() {
        when(eventRepo.findByProviderAndProviderEventId(anyString(), anyString())).thenReturn(Optional.empty());

        ModerationVerdictResult v = verdict(Constants.StreamModerationSeverity.GREEN, null);
        svc.applyVerdict(session, v);

        assertNotNull(v.getProviderEventId(), "El service debe sintetizar providerEventId si era null");
        assertEquals(true, v.getProviderEventId().startsWith("sync_"),
                "Esperado prefijo 'sync_', fue: " + v.getProviderEventId());
    }

    @Test
    @DisplayName("severity desconocida -> no-op tras persistir evento (warn)")
    void unknownSeverity_noReview() {
        when(eventRepo.findByProviderAndProviderEventId(anyString(), anyString())).thenReturn(Optional.empty());

        svc.applyVerdict(session, verdict("PURPLE", "ev-weird"));

        verify(eventRepo, times(1)).save(any(StreamModerationEvent.class));
        verify(reviewRepo, never()).save(any(StreamModerationReview.class));
        verify(streamService, never()).killStreamAsAdmin(anyLong(), anyString());
    }

    @Test
    @DisplayName("session null -> no-op defensivo")
    void nullSession_noOp() {
        svc.applyVerdict(null, verdict(Constants.StreamModerationSeverity.CRITICAL, "ev-x"));

        verify(eventRepo, never()).save(any(StreamModerationEvent.class));
        verify(reviewRepo, never()).save(any(StreamModerationReview.class));
        verify(streamService, never()).killStreamAsAdmin(anyLong(), anyString());
    }

    @Test
    @DisplayName("verdict null -> no-op defensivo")
    void nullVerdict_noOp() {
        svc.applyVerdict(session, null);

        verify(eventRepo, never()).save(any(StreamModerationEvent.class));
        verify(reviewRepo, never()).save(any(StreamModerationReview.class));
        verify(streamService, never()).killStreamAsAdmin(anyLong(), anyString());
    }
}
