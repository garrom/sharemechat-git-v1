package com.sharemechat.compliance.service;

import com.sharemechat.compliance.dto.ComplianceDashboardDTO;
import com.sharemechat.compliance.dto.ComplianceMetricsWindowDTO;
import com.sharemechat.compliance.dto.ComplianceSessionDetailDTO;
import com.sharemechat.compliance.dto.ComplianceTimelineEntryDTO;
import com.sharemechat.compliance.repository.ComplianceMetricsRepository;
import com.sharemechat.streammoderation.entity.StreamModerationEvent;
import com.sharemechat.streammoderation.entity.StreamModerationReview;
import com.sharemechat.streammoderation.entity.StreamModerationSession;
import com.sharemechat.streammoderation.repository.StreamModerationEventRepository;
import com.sharemechat.streammoderation.repository.StreamModerationReviewRepository;
import com.sharemechat.streammoderation.repository.StreamModerationSessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Servicio principal del sub-paquete Compliance Dashboard (DEC-CD-1..H).
 * Construye la Vista A (dashboard ejecutivo agregado) y la Vista B
 * (drill-down de sesion concreta). Las metricas se calculan on-the-fly
 * (DEC-CD-5; migracion a vista materializada queda como deuda).
 */
@Service
public class ComplianceDashboardService {

    private static final Logger log = LoggerFactory.getLogger(ComplianceDashboardService.class);

    private static final String WINDOW_7D = "7d";
    private static final String WINDOW_30D = "30d";
    private static final String WINDOW_CURRENT_MONTH = "current_month";

    private static final String PROVIDER_SIGHTENGINE = "SIGHTENGINE";
    private static final String PROVIDER_MOCK = "MOCK";

    private static final int TIMELINE_DEFAULT_LIMIT = 100;

    private final ComplianceMetricsRepository metricsRepository;
    private final StreamModerationSessionRepository sessionRepository;
    private final StreamModerationEventRepository eventRepository;
    private final StreamModerationReviewRepository reviewRepository;

    @Value("${compliance.dashboard.csv-export-days:30}")
    private int csvExportDays;

    public ComplianceDashboardService(ComplianceMetricsRepository metricsRepository,
                                       StreamModerationSessionRepository sessionRepository,
                                       StreamModerationEventRepository eventRepository,
                                       StreamModerationReviewRepository reviewRepository) {
        this.metricsRepository = metricsRepository;
        this.sessionRepository = sessionRepository;
        this.eventRepository = eventRepository;
        this.reviewRepository = reviewRepository;
    }

    // ========================================================================
    // VISTA A: dashboard ejecutivo
    // ========================================================================

    @Transactional(readOnly = true)
    public ComplianceDashboardDTO buildDashboard() {
        ComplianceDashboardDTO dto = new ComplianceDashboardDTO();
        dto.setGeneratedAt(LocalDateTime.now());
        dto.setLast7Days(buildWindow(WINDOW_7D, 7));
        dto.setLast30Days(buildWindow(WINDOW_30D, 30));
        dto.setCurrentMonth(buildCurrentMonth());
        dto.setAccountStatusSnapshot(metricsRepository.accountStatusSnapshot());
        dto.setTimeline7Days(metricsRepository.timelineLast7Days(TIMELINE_DEFAULT_LIMIT));
        return dto;
    }

    private ComplianceMetricsWindowDTO buildWindow(String label, int days) {
        ComplianceMetricsWindowDTO w = new ComplianceMetricsWindowDTO();
        w.setWindow(label);
        w.setSessionsModerated(metricsRepository.countSessionsInWindow(days));
        w.setFramesAnalyzed(metricsRepository.sumFramesInWindow(days));
        w.setSessionsSightengine(metricsRepository.countSessionsByProviderInWindow(PROVIDER_SIGHTENGINE, days));
        w.setSessionsMock(metricsRepository.countSessionsByProviderInWindow(PROVIDER_MOCK, days));
        w.setSessionsDegraded(metricsRepository.countSessionsDegradedInWindow(days));
        w.setReviewsBySeverity(metricsRepository.reviewsBySeverityInWindow(days));
        w.setReviewsByStatus(metricsRepository.reviewsByStatusInWindow(days));
        w.setReviewResolutionAvgMinutes(metricsRepository.reviewResolutionAvgMinutesInWindow(days));
        w.setComplaintsByStatus(metricsRepository.complaintsByStatusInWindow(days));
        w.setComplaintsBySla(metricsRepository.complaintsBySlaInWindow(days));
        w.setP2pReportsByStatus(metricsRepository.p2pReportsByStatusInWindow(days));
        return w;
    }

    private ComplianceMetricsWindowDTO buildCurrentMonth() {
        ComplianceMetricsWindowDTO w = new ComplianceMetricsWindowDTO();
        w.setWindow(WINDOW_CURRENT_MONTH);
        w.setSessionsModerated(metricsRepository.countSessionsCurrentMonth());
        w.setFramesAnalyzed(metricsRepository.sumFramesCurrentMonth());
        w.setSessionsSightengine(metricsRepository.countSessionsByProviderCurrentMonth(PROVIDER_SIGHTENGINE));
        w.setSessionsMock(metricsRepository.countSessionsByProviderCurrentMonth(PROVIDER_MOCK));
        w.setSessionsDegraded(metricsRepository.countSessionsDegradedCurrentMonth());
        w.setReviewsBySeverity(metricsRepository.reviewsBySeverityCurrentMonth());
        w.setReviewsByStatus(metricsRepository.reviewsByStatusCurrentMonth());
        w.setReviewResolutionAvgMinutes(metricsRepository.reviewResolutionAvgMinutesCurrentMonth());
        w.setComplaintsByStatus(metricsRepository.complaintsByStatusCurrentMonth());
        w.setComplaintsBySla(metricsRepository.complaintsBySlaCurrentMonth());
        w.setP2pReportsByStatus(metricsRepository.p2pReportsByStatusCurrentMonth());
        return w;
    }

    // ========================================================================
    // VISTA B: drill-down de sesion
    // ========================================================================

    @Transactional(readOnly = true)
    public ComplianceSessionDetailDTO buildSessionDetail(Long sessionId) {
        StreamModerationSession s = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Sesion no encontrada"));

        ComplianceSessionDetailDTO dto = new ComplianceSessionDetailDTO();
        dto.setSessionId(s.getId());
        dto.setStreamRecordId(s.getStreamRecordId());
        dto.setProvider(s.getProvider());
        dto.setProviderSessionId(s.getProviderSessionId());
        dto.setSamplingCadenceSeconds(s.getSamplingCadenceSeconds());
        dto.setSamplingStrategy(s.getSamplingStrategy());
        dto.setStatus(s.getStatus());
        dto.setStartedAt(s.getStartedAt());
        dto.setStoppedAt(s.getStoppedAt());
        dto.setFramesSubmitted(s.getFramesSubmitted());
        dto.setVerdictsReceived(s.getVerdictsReceived());
        dto.setDegradedSince(s.getDegradedSince());

        List<StreamModerationEvent> events = eventRepository.findByStreamModerationSessionIdOrderByIdAsc(s.getId());
        List<ComplianceSessionDetailDTO.FrameEntry> frames = new ArrayList<>();
        for (StreamModerationEvent e : events) {
            ComplianceSessionDetailDTO.FrameEntry f = new ComplianceSessionDetailDTO.FrameEntry();
            f.setEventId(e.getId());
            f.setProviderEventId(e.getProviderEventId());
            f.setEventType(e.getEventType());
            f.setIsProcessed(e.isProcessed());
            f.setReceivedAt(e.getReceivedAt());
            f.setProcessedAt(e.getProcessedAt());
            frames.add(f);
        }
        dto.setFrames(frames);

        List<StreamModerationReview> reviews = reviewRepository.findByStreamModerationSessionIdOrderByIdAsc(s.getId());
        List<ComplianceSessionDetailDTO.ReviewEntry> reviewDtos = new ArrayList<>();
        for (StreamModerationReview r : reviews) {
            ComplianceSessionDetailDTO.ReviewEntry x = new ComplianceSessionDetailDTO.ReviewEntry();
            x.setReviewId(r.getId());
            x.setCategory(r.getCategory());
            x.setSeverity(r.getSeverity());
            x.setScore(r.getScore() == null ? null : r.getScore().doubleValue());
            x.setStatus(r.getStatus());
            x.setEvidenceRef(r.getEvidenceRef());
            x.setCreatedAt(r.getCreatedAt());
            x.setReviewedAt(r.getReviewedAt());
            x.setDecisionCode(r.getDecisionCode());
            reviewDtos.add(x);
        }
        dto.setReviews(reviewDtos);

        return dto;
    }

    // ========================================================================
    // EXPORT CSV (DEC-CD-7): ventana fija 30 dias.
    // ========================================================================

    @Transactional(readOnly = true)
    public String exportCsv30Days() {
        StringBuilder sb = new StringBuilder();
        sb.append("metric,value\n");
        long sessions = metricsRepository.countSessionsInWindow(csvExportDays);
        long frames = metricsRepository.sumFramesInWindow(csvExportDays);
        long sightengine = metricsRepository.countSessionsByProviderInWindow(PROVIDER_SIGHTENGINE, csvExportDays);
        long mock = metricsRepository.countSessionsByProviderInWindow(PROVIDER_MOCK, csvExportDays);
        long degraded = metricsRepository.countSessionsDegradedInWindow(csvExportDays);
        sb.append("window_days,").append(csvExportDays).append('\n');
        sb.append("sessions_moderated,").append(sessions).append('\n');
        sb.append("frames_analyzed,").append(frames).append('\n');
        sb.append("sessions_sightengine,").append(sightengine).append('\n');
        sb.append("sessions_mock,").append(mock).append('\n');
        sb.append("sessions_degraded,").append(degraded).append('\n');
        appendMap(sb, "reviews_severity_", metricsRepository.reviewsBySeverityInWindow(csvExportDays));
        appendMap(sb, "reviews_status_", metricsRepository.reviewsByStatusInWindow(csvExportDays));
        appendMap(sb, "complaints_status_", metricsRepository.complaintsByStatusInWindow(csvExportDays));
        appendMap(sb, "complaints_sla_", metricsRepository.complaintsBySlaInWindow(csvExportDays));
        appendMap(sb, "p2p_reports_status_", metricsRepository.p2pReportsByStatusInWindow(csvExportDays));
        appendMap(sb, "users_account_status_", metricsRepository.accountStatusSnapshot());
        Double avgMin = metricsRepository.reviewResolutionAvgMinutesInWindow(csvExportDays);
        sb.append("review_resolution_avg_minutes,").append(avgMin == null ? "" : avgMin).append('\n');
        return sb.toString();
    }

    private void appendMap(StringBuilder sb, String prefix, Map<String, Long> map) {
        for (Map.Entry<String, Long> e : map.entrySet()) {
            sb.append(prefix).append(sanitizeCsvKey(e.getKey())).append(',').append(e.getValue()).append('\n');
        }
    }

    private String sanitizeCsvKey(String k) {
        if (k == null) return "null";
        return k.replaceAll("[^A-Za-z0-9_]", "_");
    }
}
