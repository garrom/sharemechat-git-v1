package com.sharemechat.compliance.controller;

import com.sharemechat.compliance.dto.ComplianceDashboardDTO;
import com.sharemechat.compliance.dto.ComplianceSessionDetailDTO;
import com.sharemechat.compliance.dto.EvidenceSignedUrlDTO;
import com.sharemechat.compliance.service.ComplianceDashboardService;
import com.sharemechat.compliance.service.ComplianceEvidenceService;
import com.sharemechat.entity.User;
import com.sharemechat.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;

import java.time.LocalDateTime;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class ComplianceControllerTest {

    private ComplianceDashboardService dashboardService;
    private ComplianceEvidenceService evidenceService;
    private UserService userService;
    private Authentication auth;
    private HttpServletRequest req;
    private ComplianceController controller;

    @BeforeEach
    void setUp() {
        dashboardService = mock(ComplianceDashboardService.class);
        evidenceService = mock(ComplianceEvidenceService.class);
        userService = mock(UserService.class);
        auth = mock(Authentication.class);
        req = mock(HttpServletRequest.class);
        when(req.getRemoteAddr()).thenReturn("10.0.0.5");
        when(auth.getName()).thenReturn("admin@sharemechat.com");
        User u = new User();
        try {
            java.lang.reflect.Field f = User.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(u, 99L);
        } catch (Exception ignore) {}
        when(userService.findByEmail("admin@sharemechat.com")).thenReturn(u);
        controller = new ComplianceController(dashboardService, evidenceService, userService);
    }

    @Test
    @DisplayName("GET /dashboard -> 200 delega a service")
    void dashboardOk() {
        ComplianceDashboardDTO dto = new ComplianceDashboardDTO();
        dto.setGeneratedAt(LocalDateTime.now());
        when(dashboardService.buildDashboard()).thenReturn(dto);
        ResponseEntity<ComplianceDashboardDTO> resp = controller.dashboard();
        assertEquals(HttpStatus.OK, resp.getStatusCode());
        verify(dashboardService).buildDashboard();
    }

    @Test
    @DisplayName("GET /sessions/{id} OK -> 200")
    void sessionDetailOk() {
        ComplianceSessionDetailDTO dto = new ComplianceSessionDetailDTO();
        dto.setSessionId(7L);
        when(dashboardService.buildSessionDetail(7L)).thenReturn(dto);
        ResponseEntity<?> resp = controller.sessionDetail(7L);
        assertEquals(HttpStatus.OK, resp.getStatusCode());
    }

    @Test
    @DisplayName("GET /sessions/{id} not found -> 404")
    void sessionDetailNotFound() {
        when(dashboardService.buildSessionDetail(7L))
                .thenThrow(new IllegalArgumentException("Sesion no encontrada"));
        ResponseEntity<?> resp = controller.sessionDetail(7L);
        assertEquals(404, resp.getStatusCode().value());
    }

    @Test
    @DisplayName("GET /evidence/{id}/signed-url con review -> 200 con URL")
    void signedUrlOk() {
        EvidenceSignedUrlDTO dto = new EvidenceSignedUrlDTO("https://s3...", null, LocalDateTime.now().plusMinutes(10), 600L);
        when(evidenceService.generateSignedUrl(eq(7L), eq(99L), anyString())).thenReturn(dto);
        ResponseEntity<?> resp = controller.signedUrl(7L, auth, req);
        assertEquals(HttpStatus.OK, resp.getStatusCode());
    }

    @Test
    @DisplayName("GET /evidence/{id}/signed-url evento sin evidence -> 200 con url=null")
    void signedUrlNoEvidence() {
        EvidenceSignedUrlDTO dto = new EvidenceSignedUrlDTO(null, "No evidence captured for GREEN verdict", null, 600L);
        when(evidenceService.generateSignedUrl(eq(7L), eq(99L), anyString())).thenReturn(dto);
        ResponseEntity<?> resp = controller.signedUrl(7L, auth, req);
        assertEquals(HttpStatus.OK, resp.getStatusCode());
        EvidenceSignedUrlDTO body = (EvidenceSignedUrlDTO) resp.getBody();
        assertNull(body.getUrl());
        assertNotNull(body.getReason());
    }

    @Test
    @DisplayName("GET /evidence/{id}/signed-url eventoId invalido -> 404")
    void signedUrlEventMissing() {
        when(evidenceService.generateSignedUrl(eq(7L), anyLong(), anyString()))
                .thenThrow(new IllegalArgumentException("Event no encontrado"));
        ResponseEntity<?> resp = controller.signedUrl(7L, auth, req);
        assertEquals(404, resp.getStatusCode().value());
    }

    @Test
    @DisplayName("GET /export/csv -> 200 text/csv con disposition attachment")
    void exportCsvOk() {
        when(dashboardService.exportCsv30Days()).thenReturn("metric,value\nsessions,10\n");
        ResponseEntity<String> resp = controller.exportCsv();
        assertEquals(HttpStatus.OK, resp.getStatusCode());
        assertTrue(resp.getHeaders().getContentType().toString().startsWith("text/csv"));
        assertTrue(resp.getHeaders().get("Content-Disposition").get(0).contains("compliance-dashboard-last-30-days.csv"));
        assertTrue(resp.getBody().contains("sessions,10"));
    }

    @Test
    @DisplayName("signedUrl sin auth -> actorUserId null + delega")
    void signedUrlNoAuth() {
        EvidenceSignedUrlDTO dto = new EvidenceSignedUrlDTO("u", null, LocalDateTime.now(), 600L);
        when(evidenceService.generateSignedUrl(eq(7L), eq(null), anyString())).thenReturn(dto);
        ResponseEntity<?> resp = controller.signedUrl(7L, null, req);
        assertEquals(HttpStatus.OK, resp.getStatusCode());
    }
}
