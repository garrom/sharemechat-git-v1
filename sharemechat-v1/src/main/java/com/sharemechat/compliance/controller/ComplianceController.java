package com.sharemechat.compliance.controller;

import com.sharemechat.compliance.dto.ComplianceDashboardDTO;
import com.sharemechat.compliance.dto.ComplianceSessionDetailDTO;
import com.sharemechat.compliance.dto.EvidenceSignedUrlDTO;
import com.sharemechat.compliance.service.ComplianceDashboardService;
import com.sharemechat.compliance.service.ComplianceEvidenceService;
import com.sharemechat.config.IpConfig;
import com.sharemechat.entity.User;
import com.sharemechat.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Endpoints admin del sub-paquete Compliance Dashboard (DEC-CD-6).
 * Protegido por SecurityConfig con permiso PERM_COMPLIANCE_DASHBOARD_VIEW
 * mas roles ADMIN y AUDIT (DEC-CD-4, gap E opcion b).
 *
 * <ul>
 *   <li>{@code GET /dashboard}: Vista A ejecutiva agregada.</li>
 *   <li>{@code GET /sessions/{id}}: Vista B drill-down frame-por-frame.</li>
 *   <li>{@code GET /evidence/{eventId}/signed-url}: URL temporal a S3 (DEC-CD-3).</li>
 *   <li>{@code GET /export/csv}: descarga CSV ventana 30 dias (DEC-CD-7).</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/admin/compliance")
public class ComplianceController {

    private final ComplianceDashboardService dashboardService;
    private final ComplianceEvidenceService evidenceService;
    private final UserService userService;

    public ComplianceController(ComplianceDashboardService dashboardService,
                                 ComplianceEvidenceService evidenceService,
                                 UserService userService) {
        this.dashboardService = dashboardService;
        this.evidenceService = evidenceService;
        this.userService = userService;
    }

    @GetMapping("/dashboard")
    public ResponseEntity<ComplianceDashboardDTO> dashboard() {
        return ResponseEntity.ok(dashboardService.buildDashboard());
    }

    @GetMapping("/sessions/{id}")
    public ResponseEntity<?> sessionDetail(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(dashboardService.buildSessionDetail(id));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(404).body(Map.of("error", ex.getMessage()));
        }
    }

    @GetMapping("/evidence/{eventId}/signed-url")
    public ResponseEntity<?> signedUrl(@PathVariable Long eventId,
                                        Authentication auth,
                                        HttpServletRequest req) {
        try {
            Long actorUserId = resolveActorUserId(auth);
            String clientIp = IpConfig.getClientIp(req);
            EvidenceSignedUrlDTO dto = evidenceService.generateSignedUrl(eventId, actorUserId, clientIp);
            return ResponseEntity.ok(dto);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(404).body(Map.of("error", ex.getMessage()));
        }
    }

    @GetMapping("/export/csv")
    public ResponseEntity<String> exportCsv() {
        String csv = dashboardService.exportCsv30Days();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"compliance-dashboard-last-30-days.csv\"")
                .body(csv);
    }

    private Long resolveActorUserId(Authentication auth) {
        if (auth == null || auth.getName() == null) return null;
        try {
            User u = userService.findByEmail(auth.getName());
            return u == null ? null : u.getId();
        } catch (Exception ignore) {
            return null;
        }
    }
}
