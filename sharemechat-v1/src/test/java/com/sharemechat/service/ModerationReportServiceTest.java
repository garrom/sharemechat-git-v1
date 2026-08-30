package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.ModerationReportReviewDTO;
import com.sharemechat.dto.ReportAbuseCreateDTO;
import com.sharemechat.entity.ModerationReport;
import com.sharemechat.entity.User;
import com.sharemechat.repository.ModerationReportRepository;
import com.sharemechat.repository.RefreshTokenRepository;
import com.sharemechat.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Enforcement de cuentas. Asegura el guard anti-XSS, el auto-suspend por reporte
 * MINOR y —lo más importante— que suspender/banear una cuenta **revoca su sesión**
 * (borra los refresh tokens de la víctima).
 */
class ModerationReportServiceTest {

    private final ModerationReportRepository reportRepo = mock(ModerationReportRepository.class);
    private final UserRepository userRepo = mock(UserRepository.class);
    private final UserBlockService userBlockService = mock(UserBlockService.class);
    private final RefreshTokenRepository refreshTokenRepo = mock(RefreshTokenRepository.class);
    private final ProductAccessGuardService accessGuard = mock(ProductAccessGuardService.class);
    private final BackofficeAuditLogService audit = mock(BackofficeAuditLogService.class);

    private final ModerationReportService svc = new ModerationReportService(
            reportRepo, userRepo, userBlockService, refreshTokenRepo, accessGuard, audit);

    private User reporter;

    @BeforeEach
    void setUp() {
        reporter = user(1L, "ACTIVE");
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("me@x.com", null));
        when(userRepo.findByEmail("me@x.com")).thenReturn(Optional.of(reporter));
        when(reportRepo.findAllByReporterUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of());
        when(reportRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private User user(long id, String status) {
        User u = new User();
        u.setId(id);
        u.setAccountStatus(status);
        return u;
    }

    private ReportAbuseCreateDTO report(Long reportedId, String type, String desc) {
        ReportAbuseCreateDTO d = new ReportAbuseCreateDTO();
        d.setReportedUserId(reportedId);
        d.setReportType(type);
        d.setDescription(desc);
        d.setAlsoBlock(false);
        return d;
    }

    // ---------- createReport ----------

    @Test
    void createReportRechazaDescripcionConCaracteresXss() {
        when(userRepo.findById(2L)).thenReturn(Optional.of(user(2L, "ACTIVE")));
        assertThatThrownBy(() -> svc.createReport(report(2L, "ABUSE", "hola <script>")))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("no permitidos");
    }

    @Test
    void createReportRechazaAutoReporte() {
        assertThatThrownBy(() -> svc.createReport(report(1L, "ABUSE", "yo mismo")))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("ti mismo");
    }

    @Test
    void reporteMinorAutoSuspendeYRevocaLaSesionDelReportado() {
        User reported = user(2L, "ACTIVE");
        when(userRepo.findById(2L)).thenReturn(Optional.of(reported));

        svc.createReport(report(2L, "MINOR", "contenido de menor"));

        assertThat(reported.getAccountStatus()).isEqualTo(Constants.AccountStatuses.SUSPENDED);
        verify(refreshTokenRepo).deleteByUserId(2L); // revoca la sesión de la víctima
        verify(userRepo).save(reported);
    }

    // ---------- adminReview ----------

    private ModerationReport reportRow(long reportedUserId) {
        ModerationReport r = new ModerationReport();
        r.setReporterUserId(1L);
        r.setReportedUserId(reportedUserId);
        r.setReportType("ABUSE");
        r.setStatus(Constants.ModerationReportStatuses.OPEN);
        r.setAdminAction(Constants.ModerationAdminActions.NONE);
        return r;
    }

    private ModerationReportReviewDTO review(String action, String notes) {
        ModerationReportReviewDTO d = new ModerationReportReviewDTO();
        d.setAdminAction(action);
        d.setResolutionNotes(notes);
        return d;
    }

    @Test
    void adminReviewSuspendRevocaLaSesion() {
        User reported = user(2L, "ACTIVE");
        when(reportRepo.findById(99L)).thenReturn(Optional.of(reportRow(2L)));
        when(userRepo.findById(2L)).thenReturn(Optional.of(reported));

        svc.adminReview(99L, 7L, review("SUSPEND", "motivo"));

        assertThat(reported.getAccountStatus()).isEqualTo(Constants.AccountStatuses.SUSPENDED);
        verify(refreshTokenRepo).deleteByUserId(2L);
    }

    @Test
    void adminReviewBanRevocaLaSesion() {
        User reported = user(2L, "ACTIVE");
        when(reportRepo.findById(99L)).thenReturn(Optional.of(reportRow(2L)));
        when(userRepo.findById(2L)).thenReturn(Optional.of(reported));

        svc.adminReview(99L, 7L, review("BAN", "motivo"));

        assertThat(reported.getAccountStatus()).isEqualTo(Constants.AccountStatuses.BANNED);
        verify(refreshTokenRepo).deleteByUserId(2L);
    }

    @Test
    void adminReviewRechazaNotasConXss() {
        when(reportRepo.findById(99L)).thenReturn(Optional.of(reportRow(2L)));
        assertThatThrownBy(() -> svc.adminReview(99L, 7L, review("SUSPEND", "malo <b>")))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("no permitidos");
        verify(refreshTokenRepo, never()).deleteByUserId(any());
    }

    @Test
    void adminReviewReporteNoEncontradoLanza() {
        when(reportRepo.findById(404L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> svc.adminReview(404L, 7L, review("NONE", "n")))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
