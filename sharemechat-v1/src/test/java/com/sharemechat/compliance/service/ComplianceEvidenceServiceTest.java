package com.sharemechat.compliance.service;

import com.sharemechat.compliance.dto.EvidenceSignedUrlDTO;
import com.sharemechat.config.ModerationEvidenceProperties;
import com.sharemechat.constants.Constants;
import com.sharemechat.service.BackofficeAuditLogService;
import com.sharemechat.streammoderation.entity.StreamModerationEvent;
import com.sharemechat.streammoderation.entity.StreamModerationReview;
import com.sharemechat.streammoderation.repository.StreamModerationEventRepository;
import com.sharemechat.streammoderation.repository.StreamModerationReviewRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;

import java.net.URI;
import java.net.URL;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class ComplianceEvidenceServiceTest {

    private ModerationEvidenceProperties props;
    private StreamModerationEventRepository eventRepo;
    private StreamModerationReviewRepository reviewRepo;
    private BackofficeAuditLogService bo;
    private S3Presigner presigner;
    private ComplianceEvidenceService svc;

    @BeforeEach
    void setUp() throws Exception {
        props = mock(ModerationEvidenceProperties.class);
        when(props.getBucket()).thenReturn("sharemechat-moderation-evidence-test");
        when(props.getRegion()).thenReturn("eu-central-1");
        eventRepo = mock(StreamModerationEventRepository.class);
        reviewRepo = mock(StreamModerationReviewRepository.class);
        bo = mock(BackofficeAuditLogService.class);
        presigner = mock(S3Presigner.class);
        svc = new ComplianceEvidenceService(props, eventRepo, reviewRepo, bo);
        svc.setPresignerForTests(presigner);
        svc.setTtlSecondsForTests(600);
    }

    @Test
    @DisplayName("generateSignedUrl event con evidence_ref -> URL presigned + audit OK")
    void signedUrlOk() throws Exception {
        StreamModerationEvent ev = newEvent(10L, "req_aa");
        when(eventRepo.findById(10L)).thenReturn(Optional.of(ev));

        StreamModerationReview r = new StreamModerationReview();
        setId(r, 5L);
        r.setEvidenceRef("test/100/req_aa.jpg");
        when(reviewRepo.findByProviderAndProviderEventId("SIGHTENGINE", "req_aa")).thenReturn(Optional.of(r));

        PresignedGetObjectRequest mockResp = mock(PresignedGetObjectRequest.class);
        when(mockResp.url()).thenReturn(new URL("https://s3.eu-central-1.amazonaws.com/test/100/req_aa.jpg?sig=x"));
        when(mockResp.expiration()).thenReturn(Instant.now().plusSeconds(600));
        when(presigner.presignGetObject(any(GetObjectPresignRequest.class))).thenReturn(mockResp);

        EvidenceSignedUrlDTO dto = svc.generateSignedUrl(10L, 99L, "10.0.0.1");
        assertNotNull(dto.getUrl());
        assertTrue(dto.getUrl().contains("test/100/req_aa.jpg"));
        assertNull(dto.getReason());
        assertEquals(600L, dto.getTtlSeconds());

        ArgumentCaptor<String> actionCap = ArgumentCaptor.forClass(String.class);
        verify(bo, atLeastOnce()).writeAuditLog(eq(99L), any(), actionCap.capture(), anyString(), any(Map.class));
        assertEquals(Constants.ComplianceAuditActions.COMPLIANCE_EVIDENCE_ACCESS, actionCap.getValue());
    }

    @Test
    @DisplayName("generateSignedUrl event GREEN sin review -> 200 con url=null + reason")
    void signedUrlNoReview() {
        StreamModerationEvent ev = newEvent(11L, "req_bb");
        when(eventRepo.findById(11L)).thenReturn(Optional.of(ev));
        when(reviewRepo.findByProviderAndProviderEventId("SIGHTENGINE", "req_bb")).thenReturn(Optional.empty());

        EvidenceSignedUrlDTO dto = svc.generateSignedUrl(11L, 99L, "10.0.0.1");
        assertNull(dto.getUrl());
        assertEquals(ComplianceEvidenceService.REASON_GREEN_VERDICT, dto.getReason());
        verify(bo, atLeastOnce()).writeAuditLog(eq(99L), any(), eq(Constants.ComplianceAuditActions.COMPLIANCE_EVIDENCE_ACCESS), anyString(), any(Map.class));
        verify(presigner, never()).presignGetObject(any(GetObjectPresignRequest.class));
    }

    @Test
    @DisplayName("generateSignedUrl review con evidence_ref vacio -> 200 con url=null")
    void signedUrlEmptyEvidenceRef() {
        StreamModerationEvent ev = newEvent(12L, "req_cc");
        when(eventRepo.findById(12L)).thenReturn(Optional.of(ev));
        StreamModerationReview r = new StreamModerationReview();
        setId(r, 6L);
        r.setEvidenceRef(null);
        when(reviewRepo.findByProviderAndProviderEventId("SIGHTENGINE", "req_cc")).thenReturn(Optional.of(r));

        EvidenceSignedUrlDTO dto = svc.generateSignedUrl(12L, 99L, "10.0.0.1");
        assertNull(dto.getUrl());
        assertEquals(ComplianceEvidenceService.REASON_GREEN_VERDICT, dto.getReason());
    }

    @Test
    @DisplayName("generateSignedUrl event no encontrado -> IllegalArgumentException")
    void signedUrlEventMissing() {
        when(eventRepo.findById(99L)).thenReturn(Optional.empty());
        assertThrows(IllegalArgumentException.class,
                () -> svc.generateSignedUrl(99L, 1L, "10.0.0.1"));
    }

    @Test
    @DisplayName("generateSignedUrl eventId null -> IllegalArgumentException")
    void signedUrlNullEventId() {
        assertThrows(IllegalArgumentException.class,
                () -> svc.generateSignedUrl(null, 1L, "10.0.0.1"));
    }

    @Test
    @DisplayName("generateSignedUrl con presigner null -> 200 con reason bucket_unavailable")
    void signedUrlBucketUnavailable() {
        svc.setPresignerForTests(null);
        StreamModerationEvent ev = newEvent(13L, "req_dd");
        when(eventRepo.findById(13L)).thenReturn(Optional.of(ev));
        StreamModerationReview r = new StreamModerationReview();
        setId(r, 7L);
        r.setEvidenceRef("test/100/req_dd.jpg");
        when(reviewRepo.findByProviderAndProviderEventId("SIGHTENGINE", "req_dd")).thenReturn(Optional.of(r));

        EvidenceSignedUrlDTO dto = svc.generateSignedUrl(13L, 99L, "10.0.0.1");
        assertNull(dto.getUrl());
        assertEquals(ComplianceEvidenceService.REASON_BUCKET_UNAVAILABLE, dto.getReason());
    }

    @Test
    @DisplayName("TTL configurable via field -> propaga a DTO")
    void ttlConfigurable() {
        svc.setTtlSecondsForTests(900);
        StreamModerationEvent ev = newEvent(14L, "req_ee");
        when(eventRepo.findById(14L)).thenReturn(Optional.of(ev));
        when(reviewRepo.findByProviderAndProviderEventId("SIGHTENGINE", "req_ee")).thenReturn(Optional.empty());
        EvidenceSignedUrlDTO dto = svc.generateSignedUrl(14L, 1L, "10.0.0.1");
        assertEquals(900L, dto.getTtlSeconds());
    }

    private StreamModerationEvent newEvent(Long id, String providerEventId) {
        StreamModerationEvent ev = new StreamModerationEvent();
        setId(ev, id);
        ev.setProvider("SIGHTENGINE");
        ev.setProviderEventId(providerEventId);
        ev.setEventType("VERDICT_RECEIVED");
        ev.setProcessed(true);
        return ev;
    }

    private static void setId(Object o, Long id) {
        try {
            java.lang.reflect.Field f = o.getClass().getDeclaredField("id");
            f.setAccessible(true);
            f.set(o, id);
        } catch (Exception ignore) {}
    }
}
