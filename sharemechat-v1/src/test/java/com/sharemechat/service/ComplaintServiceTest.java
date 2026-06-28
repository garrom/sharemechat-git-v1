package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.ComplaintDTO;
import com.sharemechat.dto.ComplaintEscalateDTO;
import com.sharemechat.dto.ComplaintReviewDTO;
import com.sharemechat.dto.PublicComplaintCreateDTO;
import com.sharemechat.entity.Complaint;
import com.sharemechat.entity.ComplaintAuditLog;
import com.sharemechat.repository.ComplaintAuditLogRepository;
import com.sharemechat.repository.ComplaintRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ComplaintServiceTest {

    private ComplaintRepository complaintRepository;
    private ComplaintAuditLogRepository auditRepository;
    private ComplaintMailService mailService;
    private ComplaintService svc;

    @BeforeEach
    void setUp() {
        complaintRepository = mock(ComplaintRepository.class);
        auditRepository = mock(ComplaintAuditLogRepository.class);
        mailService = mock(ComplaintMailService.class);
        svc = new ComplaintService(complaintRepository, auditRepository, mailService);

        when(complaintRepository.save(any(Complaint.class))).thenAnswer(inv -> {
            Complaint c = inv.getArgument(0);
            if (c.getId() == null) {
                try {
                    java.lang.reflect.Field f = Complaint.class.getDeclaredField("id");
                    f.setAccessible(true);
                    f.set(c, 100L);
                } catch (Exception ignore) {}
            }
            return c;
        });
        when(auditRepository.save(any(ComplaintAuditLog.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private PublicComplaintCreateDTO baseDto() {
        PublicComplaintCreateDTO d = new PublicComplaintCreateDTO();
        d.setCategory(Constants.ComplaintCategories.HARASSMENT);
        d.setDescription("Algo grave que necesita revisión humana.");
        return d;
    }

    // ========================================================================
    // CREATE
    // ========================================================================

    @Test
    @DisplayName("createPublic OK con reporter_email -> persiste + ack + audit log CREATED + ACK_SENT")
    void createPublic_withEmail() {
        PublicComplaintCreateDTO d = baseDto();
        d.setReporterEmail("denunciante@example.com");

        Complaint saved = svc.createPublic(d, "203.0.113.1");

        assertNotNull(saved);
        assertEquals(Constants.ComplaintCategories.HARASSMENT, saved.getCategory());
        assertEquals(Constants.ComplaintStatuses.OPEN, saved.getStatus());
        assertEquals(Constants.ComplaintChannels.WEB, saved.getChannel());
        assertNotNull(saved.getExpectedResolutionAt());
        assertNotNull(saved.getReporterIpHash()); // SHA256 IP
        assertNotNull(saved.getAcknowledgedAt()); // ack se marca tras email enviado
        verify(mailService).sendAckToReporter(any(Complaint.class));
        verify(mailService).sendAdminAlertForCritical(any(Complaint.class));
        // Audit logs: CREATED + ACK_SENT (mail no critical en HARASSMENT)
        ArgumentCaptor<ComplaintAuditLog> capt = ArgumentCaptor.forClass(ComplaintAuditLog.class);
        verify(auditRepository, atLeast(2)).save(capt.capture());
        List<String> actions = capt.getAllValues().stream().map(ComplaintAuditLog::getAction).toList();
        assertTrue(actions.contains(Constants.ComplaintAuditActions.CREATED));
        assertTrue(actions.contains(Constants.ComplaintAuditActions.ACK_SENT));
    }

    @Test
    @DisplayName("createPublic OK anónimo (sin email) -> NO se intenta ack, NO se setea acknowledged_at")
    void createPublic_anonymous() {
        PublicComplaintCreateDTO d = baseDto();
        // sin reporterEmail
        Complaint saved = svc.createPublic(d, "203.0.113.2");

        assertNull(saved.getAcknowledgedAt());
        verify(mailService).sendAckToReporter(any(Complaint.class)); // se llama pero el service detecta null y no envia
        // No deberia escribir audit log ACK_SENT
        ArgumentCaptor<ComplaintAuditLog> capt = ArgumentCaptor.forClass(ComplaintAuditLog.class);
        verify(auditRepository, atLeast(1)).save(capt.capture());
        List<String> actions = capt.getAllValues().stream().map(ComplaintAuditLog::getAction).toList();
        assertFalse(actions.contains(Constants.ComplaintAuditActions.ACK_SENT));
    }

    @Test
    @DisplayName("createPublic categoría inválida -> IllegalArgumentException")
    void createPublic_invalidCategory() {
        PublicComplaintCreateDTO d = baseDto();
        d.setCategory("NOPE");
        assertThrows(IllegalArgumentException.class, () -> svc.createPublic(d, "1.1.1.1"));
    }

    @Test
    @DisplayName("createPublic NUDITY no es categoría pública -> rechazo")
    void createPublic_nudityRejected() {
        PublicComplaintCreateDTO d = baseDto();
        d.setCategory("NUDITY");
        assertThrows(IllegalArgumentException.class, () -> svc.createPublic(d, "1.1.1.1"));
    }

    @Test
    @DisplayName("createPublic description vacío -> rechazo")
    void createPublic_emptyDescription() {
        PublicComplaintCreateDTO d = baseDto();
        d.setDescription("   ");
        assertThrows(IllegalArgumentException.class, () -> svc.createPublic(d, "1.1.1.1"));
    }

    @Test
    @DisplayName("createPublic description con < o > -> rechazo (anti-XSS básico)")
    void createPublic_xssRejected() {
        PublicComplaintCreateDTO d = baseDto();
        d.setDescription("Esto contiene <script>alert(1)</script> dentro.");
        assertThrows(IllegalArgumentException.class, () -> svc.createPublic(d, "1.1.1.1"));
    }

    @Test
    @DisplayName("createPublic categoría CSAM -> dispara alerta admin")
    void createPublic_csamFiresAdminAlert() {
        when(mailService.sendAdminAlertForCritical(any(Complaint.class))).thenReturn(true);

        PublicComplaintCreateDTO d = baseDto();
        d.setCategory(Constants.ComplaintCategories.CSAM);

        svc.createPublic(d, "1.1.1.1");
        verify(mailService).sendAdminAlertForCritical(any(Complaint.class));
        // Audit log debe contener ADMIN_ALERT_SENT
        ArgumentCaptor<ComplaintAuditLog> capt = ArgumentCaptor.forClass(ComplaintAuditLog.class);
        verify(auditRepository, atLeast(1)).save(capt.capture());
        List<String> actions = capt.getAllValues().stream().map(ComplaintAuditLog::getAction).toList();
        assertTrue(actions.contains(Constants.ComplaintAuditActions.ADMIN_ALERT_SENT));
    }

    // ========================================================================
    // computeExpectedResolutionAt — 5 business days saltando weekend
    // ========================================================================

    @Test
    @DisplayName("computeExpectedResolutionAt: lunes + 5 business days -> lunes siguiente")
    void sla_monday() {
        LocalDateTime monday = LocalDateTime.of(2026, 7, 6, 10, 0); // monday
        LocalDateTime t = ComplaintService.computeExpectedResolutionAt(monday);
        assertEquals(DayOfWeek.MONDAY, t.getDayOfWeek());
        assertEquals(13, t.getDayOfMonth());
    }

    @Test
    @DisplayName("computeExpectedResolutionAt: viernes + 5 business days -> viernes siguiente")
    void sla_friday() {
        LocalDateTime friday = LocalDateTime.of(2026, 7, 3, 10, 0); // friday
        LocalDateTime t = ComplaintService.computeExpectedResolutionAt(friday);
        assertEquals(DayOfWeek.FRIDAY, t.getDayOfWeek());
        // viernes + 1 = sabado (skip), +1 = domingo (skip), +1 = lunes (1), +1 = martes (2), +1 = miercoles (3), +1 = jueves (4), +1 = viernes (5)
        assertEquals(10, t.getDayOfMonth());
    }

    @Test
    @DisplayName("computeExpectedResolutionAt: sabado + 5 business days -> viernes siguiente")
    void sla_saturday() {
        LocalDateTime sat = LocalDateTime.of(2026, 7, 4, 10, 0); // saturday
        LocalDateTime t = ComplaintService.computeExpectedResolutionAt(sat);
        // sat + 1 = dom skip, +1 = lun(1), mar(2), mie(3), jue(4), vie(5)
        assertEquals(DayOfWeek.FRIDAY, t.getDayOfWeek());
    }

    @Test
    @DisplayName("computeExpectedResolutionAt null -> null")
    void sla_null() {
        assertNull(ComplaintService.computeExpectedResolutionAt(null));
    }

    // ========================================================================
    // REVIEW + ESCALATE
    // ========================================================================

    @Test
    @DisplayName("adminReview OPEN -> REVIEWING (sin decisionCode) -> OK + audit STATUS_CHANGED")
    void adminReview_toReviewing() {
        Complaint existing = openComplaint(1L);
        when(complaintRepository.findById(1L)).thenReturn(Optional.of(existing));

        ComplaintReviewDTO dto = new ComplaintReviewDTO();
        dto.setNewStatus(Constants.ComplaintStatuses.REVIEWING);
        dto.setNotes("Bajo revisión humana");

        ComplaintDTO out = svc.adminReview(1L, dto, 42L);
        assertEquals(Constants.ComplaintStatuses.REVIEWING, out.getStatus());

        ArgumentCaptor<ComplaintAuditLog> capt = ArgumentCaptor.forClass(ComplaintAuditLog.class);
        verify(auditRepository, atLeast(1)).save(capt.capture());
        boolean hasStatusChanged = capt.getAllValues().stream()
                .anyMatch(a -> Constants.ComplaintAuditActions.STATUS_CHANGED.equals(a.getAction()));
        assertTrue(hasStatusChanged);
    }

    @Test
    @DisplayName("adminReview transición a RESOLVED sin decisionCode -> rechazo")
    void adminReview_resolvedRequiresDecision() {
        Complaint existing = openComplaint(1L);
        when(complaintRepository.findById(1L)).thenReturn(Optional.of(existing));

        ComplaintReviewDTO dto = new ComplaintReviewDTO();
        dto.setNewStatus(Constants.ComplaintStatuses.RESOLVED);
        // sin decisionCode

        assertThrows(IllegalArgumentException.class, () -> svc.adminReview(1L, dto, 42L));
    }

    @Test
    @DisplayName("adminReview RESOLVED + decisionCode -> setResolvedAt + decisionCode persistido")
    void adminReview_resolvedWithDecision() {
        Complaint existing = openComplaint(1L);
        when(complaintRepository.findById(1L)).thenReturn(Optional.of(existing));

        ComplaintReviewDTO dto = new ComplaintReviewDTO();
        dto.setNewStatus(Constants.ComplaintStatuses.RESOLVED);
        dto.setDecisionCode(Constants.ComplaintDecisionCodes.CONTENT_REMOVED);
        dto.setNotes("Contenido eliminado");

        ComplaintDTO out = svc.adminReview(1L, dto, 42L);
        assertEquals(Constants.ComplaintStatuses.RESOLVED, out.getStatus());
        assertEquals(Constants.ComplaintDecisionCodes.CONTENT_REMOVED, out.getDecisionCode());
        assertNotNull(out.getResolvedAt());
    }

    @Test
    @DisplayName("adminReview decisionCode inválido -> rechazo")
    void adminReview_invalidDecision() {
        Complaint existing = openComplaint(1L);
        when(complaintRepository.findById(1L)).thenReturn(Optional.of(existing));

        ComplaintReviewDTO dto = new ComplaintReviewDTO();
        dto.setNewStatus(Constants.ComplaintStatuses.REVIEWING);
        dto.setDecisionCode("XYZ_FAKE");
        assertThrows(IllegalArgumentException.class, () -> svc.adminReview(1L, dto, 42L));
    }

    @Test
    @DisplayName("adminEscalate -> status ESCALATED + audit log ESCALATED")
    void adminEscalate_ok() {
        Complaint existing = openComplaint(1L);
        when(complaintRepository.findById(1L)).thenReturn(Optional.of(existing));

        ComplaintEscalateDTO dto = new ComplaintEscalateDTO();
        dto.setNotes("Reenviado a autoridades (NCMEC pendiente).");

        ComplaintDTO out = svc.adminEscalate(1L, dto, 42L);
        assertEquals(Constants.ComplaintStatuses.ESCALATED, out.getStatus());

        ArgumentCaptor<ComplaintAuditLog> capt = ArgumentCaptor.forClass(ComplaintAuditLog.class);
        verify(auditRepository, atLeast(1)).save(capt.capture());
        boolean hasEscalated = capt.getAllValues().stream()
                .anyMatch(a -> Constants.ComplaintAuditActions.ESCALATED.equals(a.getAction()));
        assertTrue(hasEscalated);
    }

    // ========================================================================
    // computeSlaState
    // ========================================================================

    @Test
    @DisplayName("computeSlaState: status RESOLVED -> OK independientemente de expected")
    void slaState_finalIsOk() {
        LocalDateTime past = LocalDateTime.now().minusDays(7);
        assertEquals("OK", ComplaintService.computeSlaState(past,
                Constants.ComplaintStatuses.RESOLVED, LocalDateTime.now()));
    }

    @Test
    @DisplayName("computeSlaState: expected futuro >24h y OPEN -> OK")
    void slaState_futureOk() {
        LocalDateTime future = LocalDateTime.now().plusDays(3);
        assertEquals("OK", ComplaintService.computeSlaState(future,
                Constants.ComplaintStatuses.OPEN, LocalDateTime.now()));
    }

    @Test
    @DisplayName("computeSlaState: expected en <24h y OPEN -> NEAR")
    void slaState_near() {
        LocalDateTime soon = LocalDateTime.now().plusHours(12);
        assertEquals("NEAR", ComplaintService.computeSlaState(soon,
                Constants.ComplaintStatuses.OPEN, LocalDateTime.now()));
    }

    @Test
    @DisplayName("computeSlaState: expected pasado y OPEN -> BREACH")
    void slaState_breach() {
        LocalDateTime past = LocalDateTime.now().minusHours(1);
        assertEquals("BREACH", ComplaintService.computeSlaState(past,
                Constants.ComplaintStatuses.OPEN, LocalDateTime.now()));
    }

    // ========================================================================
    // helpers
    // ========================================================================

    private Complaint openComplaint(Long id) {
        Complaint c = new Complaint();
        try {
            java.lang.reflect.Field f = Complaint.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(c, id);
        } catch (Exception ignore) {}
        c.setCategory(Constants.ComplaintCategories.HARASSMENT);
        c.setDescription("test");
        c.setStatus(Constants.ComplaintStatuses.OPEN);
        c.setChannel(Constants.ComplaintChannels.WEB);
        c.setCreatedAt(LocalDateTime.now().minusDays(1));
        c.setExpectedResolutionAt(LocalDateTime.now().plusDays(4));
        c.setUpdatedAt(LocalDateTime.now().minusDays(1));
        return c;
    }
}
