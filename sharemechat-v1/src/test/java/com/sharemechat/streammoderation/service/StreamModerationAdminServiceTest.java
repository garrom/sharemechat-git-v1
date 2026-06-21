package com.sharemechat.streammoderation.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.StreamRecord;
import com.sharemechat.entity.User;
import com.sharemechat.repository.StreamRecordRepository;
import com.sharemechat.service.BackofficeAuditLogService;
import com.sharemechat.service.StreamService;
import com.sharemechat.streammoderation.dto.StreamModerationConfigDTO;
import com.sharemechat.streammoderation.dto.StreamModerationReviewListItemDTO;
import com.sharemechat.streammoderation.entity.StreamModerationProviderConfig;
import com.sharemechat.streammoderation.entity.StreamModerationReview;
import com.sharemechat.streammoderation.repository.StreamModerationEventRepository;
import com.sharemechat.streammoderation.repository.StreamModerationReviewRepository;
import com.sharemechat.streammoderation.repository.StreamModerationSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests del service admin (P1.3): approve/reject + targetUserId del audit
 * log = StreamRecord.model.id (decision K1), killStreamIfActive en reject,
 * updateMode con audit log + validacion del modo.
 */
class StreamModerationAdminServiceTest {

    private StreamModerationReviewRepository reviewRepo;
    private StreamModerationSessionRepository sessionRepo;
    private StreamModerationEventRepository eventRepo;
    private StreamModerationProviderConfigService providerConfigService;
    private StreamRecordRepository streamRecordRepository;
    private StreamService streamService;
    private BackofficeAuditLogService auditLogService;
    private StreamModerationAdminService svc;

    private static final Long REVIEW_ID = 5L;
    private static final Long STREAM_ID = 200L;
    private static final Long MODEL_USER_ID = 97L;
    private static final Long CLIENT_USER_ID = 50L;
    private static final Long ACTOR_USER_ID = 12L;

    @BeforeEach
    void setUp() {
        reviewRepo = mock(StreamModerationReviewRepository.class);
        sessionRepo = mock(StreamModerationSessionRepository.class);
        eventRepo = mock(StreamModerationEventRepository.class);
        providerConfigService = mock(StreamModerationProviderConfigService.class);
        streamRecordRepository = mock(StreamRecordRepository.class);
        streamService = mock(StreamService.class);
        auditLogService = mock(BackofficeAuditLogService.class);
        svc = new StreamModerationAdminService(
                reviewRepo, sessionRepo, eventRepo, providerConfigService,
                streamRecordRepository, streamService, auditLogService);
    }

    private StreamModerationReview pendingReview() {
        StreamModerationReview r = new StreamModerationReview();
        r.setStreamRecordId(STREAM_ID);
        r.setProvider(Constants.StreamModerationProvider.MOCK);
        r.setCategory(Constants.StreamModerationCategory.NUDITY);
        r.setSeverity(Constants.StreamModerationSeverity.RED);
        r.setScore(new BigDecimal("87.50"));
        r.setStatus(Constants.StreamModerationReviewStatus.PENDING);
        r.setPriority(50);
        r.setProviderEventId("ev-1");
        return r;
    }

    private StreamRecord streamRecordWith(Long clientUserId, Long modelUserId, java.time.LocalDateTime endTime) {
        User client = new User();
        client.setId(clientUserId);
        User model = new User();
        model.setId(modelUserId);
        StreamRecord sr = new StreamRecord();
        sr.setClient(client);
        sr.setModel(model);
        sr.setEndTime(endTime);
        return sr;
    }

    @Test
    @DisplayName("approveReview: happy path -> status APPROVED, audit log con targetUserId=model.id")
    void approve_happy() {
        StreamModerationReview r = pendingReview();
        when(reviewRepo.findById(REVIEW_ID)).thenReturn(Optional.of(r));
        when(reviewRepo.save(any(StreamModerationReview.class))).thenAnswer(inv -> inv.getArgument(0));
        when(streamRecordRepository.findById(STREAM_ID))
                .thenReturn(Optional.of(streamRecordWith(CLIENT_USER_ID, MODEL_USER_ID, null)));

        StreamModerationReviewListItemDTO dto = svc.approveReview(REVIEW_ID, ACTOR_USER_ID, "ok");

        assertEquals(Constants.StreamModerationReviewStatus.APPROVED, dto.status());
        assertEquals(ACTOR_USER_ID, dto.reviewerId());

        ArgumentCaptor<Long> actorCaptor = ArgumentCaptor.forClass(Long.class);
        ArgumentCaptor<Long> targetCaptor = ArgumentCaptor.forClass(Long.class);
        ArgumentCaptor<String> actionCaptor = ArgumentCaptor.forClass(String.class);
        verify(auditLogService).writeAuditLog(
                actorCaptor.capture(), targetCaptor.capture(), actionCaptor.capture(),
                anyString(), anyMap());

        assertEquals(ACTOR_USER_ID, actorCaptor.getValue());
        assertEquals(MODEL_USER_ID, targetCaptor.getValue());
        assertEquals("STREAM_MODERATION_REVIEW_APPROVE", actionCaptor.getValue());
    }

    @Test
    @DisplayName("approveReview: review no PENDING -> IllegalStateException (409)")
    void approve_alreadyDecided() {
        StreamModerationReview r = pendingReview();
        r.setStatus(Constants.StreamModerationReviewStatus.APPROVED);
        when(reviewRepo.findById(REVIEW_ID)).thenReturn(Optional.of(r));

        assertThrows(IllegalStateException.class,
                () -> svc.approveReview(REVIEW_ID, ACTOR_USER_ID, null));
        verify(auditLogService, never()).writeAuditLog(
                anyLong(), anyLong(), anyString(), anyString(), anyMap());
    }

    @Test
    @DisplayName("approveReview: review no encontrada -> IllegalArgumentException (404)")
    void approve_notFound() {
        when(reviewRepo.findById(REVIEW_ID)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> svc.approveReview(REVIEW_ID, ACTOR_USER_ID, null));
    }

    @Test
    @DisplayName("rejectReview: killStreamIfActive=false -> no invoca killStreamAsAdmin")
    void reject_withoutKill() {
        StreamModerationReview r = pendingReview();
        when(reviewRepo.findById(REVIEW_ID)).thenReturn(Optional.of(r));
        when(reviewRepo.save(any(StreamModerationReview.class))).thenAnswer(inv -> inv.getArgument(0));
        when(streamRecordRepository.findById(STREAM_ID))
                .thenReturn(Optional.of(streamRecordWith(CLIENT_USER_ID, MODEL_USER_ID, null)));

        StreamModerationReviewListItemDTO dto = svc.rejectReview(
                REVIEW_ID, ACTOR_USER_ID, "POLICY_VIOLATION", "razon", false);

        assertEquals(Constants.StreamModerationReviewStatus.REJECTED, dto.status());
        verify(streamService, never()).killStreamAsAdmin(anyLong(), anyString());
    }

    @Test
    @DisplayName("rejectReview: killStreamIfActive=true + stream activo -> killStreamAsAdmin con razon MODERATION_REVIEW_REJECT")
    void reject_withKill_active() {
        StreamModerationReview r = pendingReview();
        when(reviewRepo.findById(REVIEW_ID)).thenReturn(Optional.of(r));
        when(reviewRepo.save(any(StreamModerationReview.class))).thenAnswer(inv -> inv.getArgument(0));
        when(streamRecordRepository.findById(STREAM_ID))
                .thenReturn(Optional.of(streamRecordWith(CLIENT_USER_ID, MODEL_USER_ID, null)));
        when(streamService.killStreamAsAdmin(anyLong(), anyString())).thenReturn(new StreamRecord());

        svc.rejectReview(REVIEW_ID, ACTOR_USER_ID, "EXPLICIT", "cut now", true);

        ArgumentCaptor<String> reasonCaptor = ArgumentCaptor.forClass(String.class);
        verify(streamService).killStreamAsAdmin(eq(STREAM_ID), reasonCaptor.capture());
        assertEquals("MODERATION_REVIEW_REJECT:EXPLICIT", reasonCaptor.getValue());

        verify(auditLogService).writeAuditLog(
                eq(ACTOR_USER_ID), eq(MODEL_USER_ID), eq("STREAM_MODERATION_REVIEW_REJECT"),
                anyString(), anyMap());
    }

    @Test
    @DisplayName("rejectReview: killStreamIfActive=true pero stream ya cerrado -> no kill, audit log con killSkippedReason")
    void reject_withKill_alreadyEnded() {
        StreamModerationReview r = pendingReview();
        when(reviewRepo.findById(REVIEW_ID)).thenReturn(Optional.of(r));
        when(reviewRepo.save(any(StreamModerationReview.class))).thenAnswer(inv -> inv.getArgument(0));
        when(streamRecordRepository.findById(STREAM_ID))
                .thenReturn(Optional.of(streamRecordWith(CLIENT_USER_ID, MODEL_USER_ID, java.time.LocalDateTime.now())));

        svc.rejectReview(REVIEW_ID, ACTOR_USER_ID, "EXPLICIT", null, true);

        verify(streamService, never()).killStreamAsAdmin(anyLong(), anyString());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> payloadCaptor = ArgumentCaptor.forClass(Map.class);
        verify(auditLogService).writeAuditLog(
                anyLong(), anyLong(), eq("STREAM_MODERATION_REVIEW_REJECT"),
                anyString(), payloadCaptor.capture());
        assertEquals(Boolean.FALSE, payloadCaptor.getValue().get("streamKilled"));
        assertEquals("already_ended", payloadCaptor.getValue().get("killSkippedReason"));
    }

    @Test
    @DisplayName("rejectReview: sin decisionCode -> IllegalArgumentException (400)")
    void reject_missingDecisionCode() {
        StreamModerationReview r = pendingReview();
        when(reviewRepo.findById(REVIEW_ID)).thenReturn(Optional.of(r));

        assertThrows(IllegalArgumentException.class,
                () -> svc.rejectReview(REVIEW_ID, ACTOR_USER_ID, null, "x", false));
        assertThrows(IllegalArgumentException.class,
                () -> svc.rejectReview(REVIEW_ID, ACTOR_USER_ID, "  ", "x", false));
    }

    @Test
    @DisplayName("rejectReview: decisionCode supera 50 chars -> IllegalArgumentException")
    void reject_decisionCodeTooLong() {
        StreamModerationReview r = pendingReview();
        when(reviewRepo.findById(REVIEW_ID)).thenReturn(Optional.of(r));
        String tooLong = "A".repeat(51);

        assertThrows(IllegalArgumentException.class,
                () -> svc.rejectReview(REVIEW_ID, ACTOR_USER_ID, tooLong, null, false));
    }

    @Test
    @DisplayName("updateMode: modo invalido -> IllegalArgumentException, sin audit log")
    void updateMode_invalid() {
        assertThrows(IllegalArgumentException.class,
                () -> svc.updateMode("VERIFF", ACTOR_USER_ID, null));
        verify(auditLogService, never()).writeAuditLog(
                anyLong(), anyLong(), anyString(), anyString(), anyMap());
    }

    @Test
    @DisplayName("updateMode: modo valido -> audit log con STREAM_MODERATION_PROVIDER_CONFIG_CHANGE")
    void updateMode_valid() {
        StreamModerationProviderConfig before = new StreamModerationProviderConfig();
        before.setProviderKey(Constants.StreamModerationProviderKeys.STREAM_VISUAL_MODERATION);
        before.setActiveMode(Constants.StreamModerationProvider.MOCK);
        when(providerConfigService.getActiveMode()).thenReturn(Constants.StreamModerationProvider.MOCK);

        StreamModerationProviderConfig updated = new StreamModerationProviderConfig();
        updated.setProviderKey(Constants.StreamModerationProviderKeys.STREAM_VISUAL_MODERATION);
        updated.setActiveMode(Constants.StreamModerationProvider.SIGHTENGINE);
        updated.setEnabled(true);
        when(providerConfigService.setActiveMode(eq("SIGHTENGINE"), eq(ACTOR_USER_ID), anyString()))
                .thenReturn(updated);

        StreamModerationConfigDTO dto = svc.updateMode("SIGHTENGINE", ACTOR_USER_ID, "switch to real");

        assertEquals("SIGHTENGINE", dto.activeMode());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> payloadCaptor = ArgumentCaptor.forClass(Map.class);
        verify(auditLogService).writeAuditLog(
                eq(ACTOR_USER_ID), eq(ACTOR_USER_ID),
                eq("STREAM_MODERATION_PROVIDER_CONFIG_CHANGE"),
                anyString(), payloadCaptor.capture());
        assertEquals("MOCK", payloadCaptor.getValue().get("previousMode"));
        assertEquals("SIGHTENGINE", payloadCaptor.getValue().get("newMode"));
    }
}
