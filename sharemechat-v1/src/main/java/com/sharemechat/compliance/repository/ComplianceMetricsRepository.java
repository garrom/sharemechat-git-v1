package com.sharemechat.compliance.repository;

import com.sharemechat.compliance.dto.ComplianceTimelineEntryDTO;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Queries optimizadas para metricas on-the-fly (DEC-CD-5). Todas las
 * agregaciones usan indices ya existentes en TEST (ver Fase A analisis
 * previo). No introduce migration V12.
 *
 * <p>Implementacion con JdbcTemplate por simplicidad: las queries son
 * agregaciones puras, no requieren mapeo a entidad JPA.
 */
@Repository
public class ComplianceMetricsRepository {

    private final JdbcTemplate jdbcTemplate;

    public ComplianceMetricsRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    // ========================================================================
    // Conteos por ventana
    // ========================================================================

    public long countSessionsInWindow(int days) {
        Long n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM stream_moderation_sessions WHERE created_at >= NOW() - INTERVAL ? DAY",
                Long.class, days);
        return n == null ? 0L : n;
    }

    public long countSessionsCurrentMonth() {
        Long n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM stream_moderation_sessions WHERE created_at >= DATE_FORMAT(NOW(),'%Y-%m-01')",
                Long.class);
        return n == null ? 0L : n;
    }

    public long sumFramesInWindow(int days) {
        Long n = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(frames_submitted),0) FROM stream_moderation_sessions WHERE created_at >= NOW() - INTERVAL ? DAY",
                Long.class, days);
        return n == null ? 0L : n;
    }

    public long sumFramesCurrentMonth() {
        Long n = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(frames_submitted),0) FROM stream_moderation_sessions WHERE created_at >= DATE_FORMAT(NOW(),'%Y-%m-01')",
                Long.class);
        return n == null ? 0L : n;
    }

    public long countSessionsByProviderInWindow(String provider, int days) {
        Long n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM stream_moderation_sessions WHERE provider=? AND created_at >= NOW() - INTERVAL ? DAY",
                Long.class, provider, days);
        return n == null ? 0L : n;
    }

    public long countSessionsByProviderCurrentMonth(String provider) {
        Long n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM stream_moderation_sessions WHERE provider=? AND created_at >= DATE_FORMAT(NOW(),'%Y-%m-01')",
                Long.class, provider);
        return n == null ? 0L : n;
    }

    public long countSessionsDegradedInWindow(int days) {
        Long n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM stream_moderation_sessions WHERE degraded_since IS NOT NULL AND created_at >= NOW() - INTERVAL ? DAY",
                Long.class, days);
        return n == null ? 0L : n;
    }

    public long countSessionsDegradedCurrentMonth() {
        Long n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM stream_moderation_sessions WHERE degraded_since IS NOT NULL AND created_at >= DATE_FORMAT(NOW(),'%Y-%m-01')",
                Long.class);
        return n == null ? 0L : n;
    }

    public Map<String, Long> reviewsBySeverityInWindow(int days) {
        Map<String, Long> result = new LinkedHashMap<>();
        jdbcTemplate.query(
                "SELECT severity, COUNT(*) AS n FROM stream_moderation_reviews WHERE created_at >= NOW() - INTERVAL ? DAY GROUP BY severity",
                rs -> { result.put(rs.getString(1), rs.getLong(2)); },
                days);
        return result;
    }

    public Map<String, Long> reviewsBySeverityCurrentMonth() {
        Map<String, Long> result = new LinkedHashMap<>();
        jdbcTemplate.query(
                "SELECT severity, COUNT(*) AS n FROM stream_moderation_reviews WHERE created_at >= DATE_FORMAT(NOW(),'%Y-%m-01') GROUP BY severity",
                rs -> { result.put(rs.getString(1), rs.getLong(2)); });
        return result;
    }

    public Map<String, Long> reviewsByStatusInWindow(int days) {
        Map<String, Long> result = new LinkedHashMap<>();
        jdbcTemplate.query(
                "SELECT status, COUNT(*) AS n FROM stream_moderation_reviews WHERE created_at >= NOW() - INTERVAL ? DAY GROUP BY status",
                rs -> { result.put(rs.getString(1), rs.getLong(2)); },
                days);
        return result;
    }

    public Map<String, Long> reviewsByStatusCurrentMonth() {
        Map<String, Long> result = new LinkedHashMap<>();
        jdbcTemplate.query(
                "SELECT status, COUNT(*) AS n FROM stream_moderation_reviews WHERE created_at >= DATE_FORMAT(NOW(),'%Y-%m-01') GROUP BY status",
                rs -> { result.put(rs.getString(1), rs.getLong(2)); });
        return result;
    }

    public Double reviewResolutionAvgMinutesInWindow(int days) {
        return jdbcTemplate.queryForObject(
                "SELECT AVG(TIMESTAMPDIFF(MINUTE, created_at, reviewed_at)) FROM stream_moderation_reviews WHERE status='RESOLVED' AND reviewed_at >= NOW() - INTERVAL ? DAY",
                Double.class, days);
    }

    public Double reviewResolutionAvgMinutesCurrentMonth() {
        return jdbcTemplate.queryForObject(
                "SELECT AVG(TIMESTAMPDIFF(MINUTE, created_at, reviewed_at)) FROM stream_moderation_reviews WHERE status='RESOLVED' AND reviewed_at >= DATE_FORMAT(NOW(),'%Y-%m-01')",
                Double.class);
    }

    public Map<String, Long> complaintsByStatusInWindow(int days) {
        Map<String, Long> result = new LinkedHashMap<>();
        jdbcTemplate.query(
                "SELECT status, COUNT(*) AS n FROM complaints WHERE created_at >= NOW() - INTERVAL ? DAY GROUP BY status",
                rs -> { result.put(rs.getString(1), rs.getLong(2)); },
                days);
        return result;
    }

    public Map<String, Long> complaintsByStatusCurrentMonth() {
        Map<String, Long> result = new LinkedHashMap<>();
        jdbcTemplate.query(
                "SELECT status, COUNT(*) AS n FROM complaints WHERE created_at >= DATE_FORMAT(NOW(),'%Y-%m-01') GROUP BY status",
                rs -> { result.put(rs.getString(1), rs.getLong(2)); });
        return result;
    }

    public Map<String, Long> complaintsBySlaInWindow(int days) {
        Map<String, Long> result = new LinkedHashMap<>();
        jdbcTemplate.query(
                "SELECT CASE WHEN status IN ('RESOLVED','REJECTED','ESCALATED') THEN 'CLOSED' " +
                        " WHEN expected_resolution_at < NOW() THEN 'BREACH' " +
                        " WHEN expected_resolution_at < NOW() + INTERVAL 24 HOUR THEN 'NEAR' " +
                        " ELSE 'OK' END AS bucket, COUNT(*) AS n " +
                        "FROM complaints WHERE created_at >= NOW() - INTERVAL ? DAY GROUP BY bucket",
                rs -> { result.put(rs.getString(1), rs.getLong(2)); },
                days);
        return result;
    }

    public Map<String, Long> complaintsBySlaCurrentMonth() {
        Map<String, Long> result = new LinkedHashMap<>();
        jdbcTemplate.query(
                "SELECT CASE WHEN status IN ('RESOLVED','REJECTED','ESCALATED') THEN 'CLOSED' " +
                        " WHEN expected_resolution_at < NOW() THEN 'BREACH' " +
                        " WHEN expected_resolution_at < NOW() + INTERVAL 24 HOUR THEN 'NEAR' " +
                        " ELSE 'OK' END AS bucket, COUNT(*) AS n " +
                        "FROM complaints WHERE created_at >= DATE_FORMAT(NOW(),'%Y-%m-01') GROUP BY bucket",
                rs -> { result.put(rs.getString(1), rs.getLong(2)); });
        return result;
    }

    public Map<String, Long> p2pReportsByStatusInWindow(int days) {
        Map<String, Long> result = new LinkedHashMap<>();
        jdbcTemplate.query(
                "SELECT status, COUNT(*) AS n FROM moderation_reports WHERE created_at >= NOW() - INTERVAL ? DAY GROUP BY status",
                rs -> { result.put(rs.getString(1), rs.getLong(2)); },
                days);
        return result;
    }

    public Map<String, Long> p2pReportsByStatusCurrentMonth() {
        Map<String, Long> result = new LinkedHashMap<>();
        jdbcTemplate.query(
                "SELECT status, COUNT(*) AS n FROM moderation_reports WHERE created_at >= DATE_FORMAT(NOW(),'%Y-%m-01') GROUP BY status",
                rs -> { result.put(rs.getString(1), rs.getLong(2)); });
        return result;
    }

    public Map<String, Long> accountStatusSnapshot() {
        Map<String, Long> result = new LinkedHashMap<>();
        jdbcTemplate.query(
                "SELECT account_status, COUNT(*) AS n FROM users GROUP BY account_status",
                rs -> { result.put(rs.getString(1), rs.getLong(2)); });
        return result;
    }

    // ========================================================================
    // Timeline cronologica (ultimos 7 dias)
    // ========================================================================

    public List<ComplianceTimelineEntryDTO> timelineLast7Days(int limit) {
        java.util.List<ComplianceTimelineEntryDTO> all = new java.util.ArrayList<>();
        queryTimelineRows(all, "SESSION_STARTED",
                "SELECT id, provider, started_at FROM stream_moderation_sessions WHERE started_at >= NOW() - INTERVAL 7 DAY");
        queryTimelineRows(all, "REVIEW_CREATED",
                "SELECT id, CONCAT(severity,'/',category) AS detail, created_at FROM stream_moderation_reviews WHERE created_at >= NOW() - INTERVAL 7 DAY");
        queryTimelineRows(all, "COMPLAINT_CREATED",
                "SELECT id, category, created_at FROM complaints WHERE created_at >= NOW() - INTERVAL 7 DAY");
        queryTimelineRows(all, "P2P_REPORT_CREATED",
                "SELECT id, report_type, created_at FROM moderation_reports WHERE created_at >= NOW() - INTERVAL 7 DAY");
        queryTimelineRowsBoAudit(all,
                "SELECT id, action, summary, created_at FROM backoffice_access_audit_log " +
                        "WHERE created_at >= NOW() - INTERVAL 7 DAY " +
                        "AND action IN ('USER_ACCOUNT_STATUS_CHANGE','COMPLIANCE_EVIDENCE_ACCESS','STREAM_MODERATION_PROVIDER_CONFIG_CHANGE')");

        all.sort((a, b) -> {
            if (a.getTs() == null && b.getTs() == null) return 0;
            if (a.getTs() == null) return 1;
            if (b.getTs() == null) return -1;
            return b.getTs().compareTo(a.getTs());
        });
        if (all.size() > limit) return all.subList(0, limit);
        return all;
    }

    private void queryTimelineRows(java.util.List<ComplianceTimelineEntryDTO> sink,
                                    String typeLabel, String sql) {
        jdbcTemplate.query(sql, rs -> {
            Timestamp ts = rs.getTimestamp(3);
            LocalDateTime ldt = ts == null ? null : ts.toLocalDateTime();
            sink.add(new ComplianceTimelineEntryDTO(
                    typeLabel,
                    (Long) rs.getObject(1),
                    rs.getString(2),
                    ldt));
        });
    }

    private void queryTimelineRowsBoAudit(java.util.List<ComplianceTimelineEntryDTO> sink, String sql) {
        jdbcTemplate.query(sql, rs -> {
            Timestamp ts = rs.getTimestamp(4);
            LocalDateTime ldt = ts == null ? null : ts.toLocalDateTime();
            sink.add(new ComplianceTimelineEntryDTO(
                    "BO_AUDIT_" + rs.getString(2),
                    (Long) rs.getObject(1),
                    rs.getString(3),
                    ldt));
        });
    }
}
