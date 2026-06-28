package com.sharemechat.compliance.service;

import com.sharemechat.compliance.dto.ComplianceDashboardDTO;
import com.sharemechat.compliance.dto.ComplianceSessionDetailDTO;
import com.sharemechat.compliance.dto.ComplianceTimelineEntryDTO;
import com.sharemechat.compliance.repository.ComplianceMetricsRepository;
import com.sharemechat.streammoderation.entity.StreamModerationEvent;
import com.sharemechat.streammoderation.entity.StreamModerationReview;
import com.sharemechat.streammoderation.entity.StreamModerationSession;
import com.sharemechat.streammoderation.repository.StreamModerationEventRepository;
import com.sharemechat.streammoderation.repository.StreamModerationReviewRepository;
import com.sharemechat.streammoderation.repository.StreamModerationSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class ComplianceDashboardServiceTest {

    private ComplianceMetricsRepository metrics;
    private StreamModerationSessionRepository sessionRepo;
    private StreamModerationEventRepository eventRepo;
    private StreamModerationReviewRepository reviewRepo;
    private ComplianceDashboardService svc;

    @BeforeEach
    void setUp() {
        metrics = mock(ComplianceMetricsRepository.class);
        sessionRepo = mock(StreamModerationSessionRepository.class);
        eventRepo = mock(StreamModerationEventRepository.class);
        reviewRepo = mock(StreamModerationReviewRepository.class);
        svc = new ComplianceDashboardService(metrics, sessionRepo, eventRepo, reviewRepo);
        ReflectionTestUtils.setField(svc, "csvExportDays", 30);
    }

    @Test
    @DisplayName("buildDashboard agrega 3 ventanas + snapshot + timeline")
    void buildDashboardOk() {
        when(metrics.countSessionsInWindow(7)).thenReturn(5L);
        when(metrics.countSessionsInWindow(30)).thenReturn(20L);
        when(metrics.countSessionsCurrentMonth()).thenReturn(12L);
        when(metrics.accountStatusSnapshot()).thenReturn(Map.of("ACTIVE", 100L, "SUSPENDED", 2L));
        when(metrics.timelineLast7Days(anyInt())).thenReturn(List.of(
                new ComplianceTimelineEntryDTO("SESSION_STARTED", 1L, "SIGHTENGINE", LocalDateTime.now())));

        ComplianceDashboardDTO dto = svc.buildDashboard();
        assertNotNull(dto.getGeneratedAt());
        assertEquals("7d", dto.getLast7Days().getWindow());
        assertEquals(5L, dto.getLast7Days().getSessionsModerated());
        assertEquals("30d", dto.getLast30Days().getWindow());
        assertEquals(20L, dto.getLast30Days().getSessionsModerated());
        assertEquals("current_month", dto.getCurrentMonth().getWindow());
        assertEquals(12L, dto.getCurrentMonth().getSessionsModerated());
        assertEquals(100L, dto.getAccountStatusSnapshot().get("ACTIVE"));
        assertEquals(1, dto.getTimeline7Days().size());
    }

    @Test
    @DisplayName("buildDashboard sin datos -> 0s en cards y mapas vacios")
    void buildDashboardEmpty() {
        when(metrics.accountStatusSnapshot()).thenReturn(new LinkedHashMap<>());
        when(metrics.timelineLast7Days(anyInt())).thenReturn(List.of());
        ComplianceDashboardDTO dto = svc.buildDashboard();
        assertEquals(0L, dto.getLast7Days().getSessionsModerated());
        assertEquals(0L, dto.getLast30Days().getFramesAnalyzed());
        assertTrue(dto.getAccountStatusSnapshot().isEmpty());
        assertTrue(dto.getTimeline7Days().isEmpty());
    }

    @Test
    @DisplayName("buildDashboard propaga reviewResolutionAvgMinutes null")
    void buildDashboardNullLatency() {
        when(metrics.reviewResolutionAvgMinutesInWindow(7)).thenReturn(null);
        when(metrics.reviewResolutionAvgMinutesInWindow(30)).thenReturn(42.5);
        ComplianceDashboardDTO dto = svc.buildDashboard();
        assertNull(dto.getLast7Days().getReviewResolutionAvgMinutes());
        assertEquals(42.5, dto.getLast30Days().getReviewResolutionAvgMinutes());
    }

    @Test
    @DisplayName("buildDashboard agrega sightengine vs mock + degraded")
    void buildDashboardProviders() {
        when(metrics.countSessionsByProviderInWindow("SIGHTENGINE", 30)).thenReturn(15L);
        when(metrics.countSessionsByProviderInWindow("MOCK", 30)).thenReturn(2L);
        when(metrics.countSessionsDegradedInWindow(30)).thenReturn(1L);
        ComplianceDashboardDTO dto = svc.buildDashboard();
        assertEquals(15L, dto.getLast30Days().getSessionsSightengine());
        assertEquals(2L, dto.getLast30Days().getSessionsMock());
        assertEquals(1L, dto.getLast30Days().getSessionsDegraded());
    }

    @Test
    @DisplayName("buildSessionDetail propaga metadata + frames + reviews")
    void buildSessionDetailOk() {
        StreamModerationSession s = new StreamModerationSession();
        setId(s, 42L);
        s.setStreamRecordId(100L);
        s.setProvider("SIGHTENGINE");
        s.setProviderSessionId(null);
        s.setSamplingCadenceSeconds(15);
        s.setSamplingStrategy("INTERVAL");
        s.setStatus("STOPPED");
        s.setStoppedAt(LocalDateTime.now());
        s.setFramesSubmitted(6);
        s.setVerdictsReceived(6);
        when(sessionRepo.findById(42L)).thenReturn(Optional.of(s));

        StreamModerationEvent ev = new StreamModerationEvent();
        setId(ev, 7L);
        ev.setProvider("SIGHTENGINE");
        ev.setProviderEventId("req_xxx");
        ev.setEventType("VERDICT_RECEIVED");
        ev.setProcessed(true);
        when(eventRepo.findByStreamModerationSessionIdOrderByIdAsc(42L)).thenReturn(List.of(ev));
        when(reviewRepo.findByStreamModerationSessionIdOrderByIdAsc(42L)).thenReturn(List.of());

        ComplianceSessionDetailDTO dto = svc.buildSessionDetail(42L);
        assertEquals(42L, dto.getSessionId());
        assertEquals(100L, dto.getStreamRecordId());
        assertEquals("SIGHTENGINE", dto.getProvider());
        assertEquals(6, dto.getFramesSubmitted());
        assertEquals(1, dto.getFrames().size());
        assertEquals(7L, dto.getFrames().get(0).getEventId());
        assertEquals(true, dto.getFrames().get(0).getIsProcessed());
        assertEquals(0, dto.getReviews().size());
    }

    @Test
    @DisplayName("buildSessionDetail con reviews -> propaga severity/category/evidence")
    void buildSessionDetailWithReviews() {
        StreamModerationSession s = new StreamModerationSession();
        setId(s, 50L);
        when(sessionRepo.findById(50L)).thenReturn(Optional.of(s));

        StreamModerationReview r = new StreamModerationReview();
        setId(r, 1L);
        r.setSeverity("RED");
        r.setCategory("NUDITY");
        r.setScore(new BigDecimal("0.85"));
        r.setStatus("PENDING");
        r.setEvidenceRef("test/50/req_aa.jpg");
        when(reviewRepo.findByStreamModerationSessionIdOrderByIdAsc(50L)).thenReturn(List.of(r));
        when(eventRepo.findByStreamModerationSessionIdOrderByIdAsc(50L)).thenReturn(List.of());

        ComplianceSessionDetailDTO dto = svc.buildSessionDetail(50L);
        assertEquals(1, dto.getReviews().size());
        assertEquals("RED", dto.getReviews().get(0).getSeverity());
        assertEquals("test/50/req_aa.jpg", dto.getReviews().get(0).getEvidenceRef());
        assertEquals(0.85, dto.getReviews().get(0).getScore());
    }

    @Test
    @DisplayName("buildSessionDetail session no encontrada -> IllegalArgumentException")
    void buildSessionDetailNotFound() {
        when(sessionRepo.findById(999L)).thenReturn(Optional.empty());
        assertThrows(IllegalArgumentException.class, () -> svc.buildSessionDetail(999L));
    }

    @Test
    @DisplayName("exportCsv30Days incluye cabecera + bloque de metricas + maps con prefijos")
    void exportCsvOk() {
        when(metrics.countSessionsInWindow(30)).thenReturn(20L);
        when(metrics.sumFramesInWindow(30)).thenReturn(120L);
        when(metrics.countSessionsByProviderInWindow("SIGHTENGINE", 30)).thenReturn(18L);
        when(metrics.countSessionsByProviderInWindow("MOCK", 30)).thenReturn(2L);
        when(metrics.reviewsBySeverityInWindow(30)).thenReturn(Map.of("GREEN", 100L, "AMBER", 3L));
        when(metrics.complaintsByStatusInWindow(30)).thenReturn(Map.of("OPEN", 1L));
        when(metrics.accountStatusSnapshot()).thenReturn(Map.of("ACTIVE", 50L));

        String csv = svc.exportCsv30Days();
        assertTrue(csv.startsWith("metric,value\n"));
        assertTrue(csv.contains("sessions_moderated,20"));
        assertTrue(csv.contains("frames_analyzed,120"));
        assertTrue(csv.contains("sessions_sightengine,18"));
        assertTrue(csv.contains("reviews_severity_GREEN,100"));
        assertTrue(csv.contains("reviews_severity_AMBER,3"));
        assertTrue(csv.contains("complaints_status_OPEN,1"));
        assertTrue(csv.contains("users_account_status_ACTIVE,50"));
        assertTrue(csv.contains("window_days,30"));
    }

    @Test
    @DisplayName("exportCsv30Days sanitiza claves con caracteres no alfanumericos")
    void exportCsvKeySanitization() {
        Map<String, Long> map = new LinkedHashMap<>();
        map.put("we-ird:key!", 7L);
        when(metrics.reviewsBySeverityInWindow(30)).thenReturn(map);
        String csv = svc.exportCsv30Days();
        assertTrue(csv.contains("reviews_severity_we_ird_key_,7"));
    }

    @Test
    @DisplayName("buildDashboard timeline limit fijo a 100")
    void timelineLimitFixed() {
        when(metrics.timelineLast7Days(eq(100))).thenReturn(List.of());
        svc.buildDashboard();
        verify(metrics).timelineLast7Days(100);
    }

    @Test
    @DisplayName("Ventana 7d invoca repos con dias=7")
    void window7VarVerify() {
        svc.buildDashboard();
        verify(metrics).countSessionsInWindow(7);
        verify(metrics).countSessionsInWindow(30);
        verify(metrics).countSessionsCurrentMonth();
    }

    @Test
    @DisplayName("buildDashboard expone reviewsBySeverity / status maps")
    void mapsFlowThrough() {
        Map<String, Long> sev = Map.of("RED", 4L);
        Map<String, Long> st = Map.of("RESOLVED", 4L);
        when(metrics.reviewsBySeverityInWindow(30)).thenReturn(sev);
        when(metrics.reviewsByStatusInWindow(30)).thenReturn(st);
        ComplianceDashboardDTO dto = svc.buildDashboard();
        assertEquals(4L, dto.getLast30Days().getReviewsBySeverity().get("RED"));
        assertEquals(4L, dto.getLast30Days().getReviewsByStatus().get("RESOLVED"));
    }

    @Test
    @DisplayName("buildDashboard expone complaintsBySla map")
    void complaintsSlaFlowThrough() {
        when(metrics.complaintsBySlaInWindow(30)).thenReturn(Map.of("BREACH", 2L, "OK", 10L));
        ComplianceDashboardDTO dto = svc.buildDashboard();
        assertEquals(2L, dto.getLast30Days().getComplaintsBySla().get("BREACH"));
        assertEquals(10L, dto.getLast30Days().getComplaintsBySla().get("OK"));
    }

    @Test
    @DisplayName("buildDashboard expone p2pReportsByStatus")
    void p2pReportsFlowThrough() {
        when(metrics.p2pReportsByStatusInWindow(30)).thenReturn(Map.of("OPEN", 5L));
        ComplianceDashboardDTO dto = svc.buildDashboard();
        assertEquals(5L, dto.getLast30Days().getP2pReportsByStatus().get("OPEN"));
    }

    private static void setId(Object o, Long id) {
        try {
            java.lang.reflect.Field f = o.getClass().getDeclaredField("id");
            f.setAccessible(true);
            f.set(o, id);
        } catch (Exception ignore) {}
    }
}
