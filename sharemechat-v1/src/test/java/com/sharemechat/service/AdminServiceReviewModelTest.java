package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.KycSession;
import com.sharemechat.entity.User;
import com.sharemechat.repository.AdminRepository;
import com.sharemechat.repository.KycSessionRepository;
import com.sharemechat.repository.ModelDocumentRepository;
import com.sharemechat.repository.ModelRepository;
import com.sharemechat.repository.ModelReviewChecklistRepository;
import com.sharemechat.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests P15 (email modelo tras decisión admin) — cierre 2026-06-20.
 * AdminService.reviewModel envía email BEST_EFFORT al modelo en APPROVE
 * y REJECT. PENDING NO envía. Si el envío falla, log WARN y NO rollback.
 */
class AdminServiceReviewModelTest {

    private UserRepository userRepository;
    private UserService userService;
    private ModelRepository modelRepository;
    private AdminRepository adminRepository;
    private NamedParameterJdbcTemplate jdbc;
    private ModelDocumentRepository modelDocumentRepository;
    private ModelReviewChecklistRepository checklistRepository;
    private EmailVerificationService emailVerificationService;
    private EmailService emailService;
    private EmailCopyRenderer emailCopyRenderer;
    private KycSessionRepository kycSessionRepository;
    private AdminService adminService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        userService = mock(UserService.class);
        modelRepository = mock(ModelRepository.class);
        adminRepository = mock(AdminRepository.class);
        jdbc = mock(NamedParameterJdbcTemplate.class);
        modelDocumentRepository = mock(ModelDocumentRepository.class);
        checklistRepository = mock(ModelReviewChecklistRepository.class);
        emailVerificationService = mock(EmailVerificationService.class);
        emailService = mock(EmailService.class);
        emailCopyRenderer = mock(EmailCopyRenderer.class);
        kycSessionRepository = mock(KycSessionRepository.class);

        adminService = new AdminService(
                userRepository, userService, modelRepository, adminRepository,
                jdbc, modelDocumentRepository, checklistRepository,
                emailVerificationService, emailService, emailCopyRenderer,
                kycSessionRepository
        );
    }

    private static User newPendingModel(long id, String email) {
        User u = new User();
        u.setId(id);
        u.setEmail(email);
        u.setRole(Constants.Roles.USER);
        u.setUserType("FORM_MODEL");
        u.setVerificationStatus(Constants.VerificationStatuses.PENDING);
        return u;
    }

    @Test
    @DisplayName("APPROVE: persiste APPROVED + MODEL + envia email MODEL_REVIEW_APPROVED al destinatario correcto")
    void approveSendsApprovedEmail() {
        User user = newPendingModel(100L, "demo+model@sharemechat.com");
        when(userRepository.findById(100L)).thenReturn(Optional.of(user));
        when(modelRepository.existsById(100L)).thenReturn(false);
        when(emailCopyRenderer.renderModelReviewDecision(any(User.class), eq("APPROVE")))
                .thenReturn(new EmailCopyRenderer.EmailContent(
                        "Tu cuenta de modelo ha sido aprobada", "<p>body approve</p>"));

        String result = adminService.reviewModel(100L, "APPROVE");

        assertNotNull(result);
        assertEquals(Constants.VerificationStatuses.APPROVED, user.getVerificationStatus());
        assertEquals(Constants.Roles.MODEL, user.getRole());

        ArgumentCaptor<EmailMessage> captor = ArgumentCaptor.forClass(EmailMessage.class);
        verify(emailService, times(1)).send(captor.capture());
        EmailMessage sent = captor.getValue();
        assertEquals("demo+model@sharemechat.com", sent.to());
        assertEquals(EmailMessage.Category.MODEL_REVIEW_APPROVED, sent.category());
        assertEquals(EmailMessage.Priority.BEST_EFFORT, sent.priority());
        assertEquals("Tu cuenta de modelo ha sido aprobada", sent.subject());
    }

    @Test
    @DisplayName("REJECT: persiste REJECTED + envia email MODEL_REVIEW_REJECTED")
    void rejectSendsRejectedEmail() {
        User user = newPendingModel(101L, "demo+model2@sharemechat.com");
        when(userRepository.findById(101L)).thenReturn(Optional.of(user));
        when(emailCopyRenderer.renderModelReviewDecision(any(User.class), eq("REJECT")))
                .thenReturn(new EmailCopyRenderer.EmailContent(
                        "Tu verificación no ha sido aprobada", "<p>body reject</p>"));

        adminService.reviewModel(101L, "REJECT");

        assertEquals(Constants.VerificationStatuses.REJECTED, user.getVerificationStatus());

        ArgumentCaptor<EmailMessage> captor = ArgumentCaptor.forClass(EmailMessage.class);
        verify(emailService, times(1)).send(captor.capture());
        EmailMessage sent = captor.getValue();
        assertEquals("demo+model2@sharemechat.com", sent.to());
        assertEquals(EmailMessage.Category.MODEL_REVIEW_REJECTED, sent.category());
        assertEquals(EmailMessage.Priority.BEST_EFFORT, sent.priority());
    }

    @Test
    @DisplayName("PENDING: persiste PENDING y NO envia email")
    void pendingDoesNotSendEmail() {
        User user = newPendingModel(102L, "demo+model3@sharemechat.com");
        when(userRepository.findById(102L)).thenReturn(Optional.of(user));

        adminService.reviewModel(102L, "PENDING");

        assertEquals(Constants.VerificationStatuses.PENDING, user.getVerificationStatus());
        verify(emailService, never()).send(any(EmailMessage.class));
    }

    @Test
    @DisplayName("REPEAT: resetea verification_status a NULL + cancela kyc_session MODEL + envía email MODEL_REVIEW_REPEAT")
    void repeatResetsAndCancelsAndSendsEmail() {
        User user = new User();
        user.setId(104L);
        user.setEmail("demo+repeat@sharemechat.com");
        user.setRole(Constants.Roles.USER);
        user.setUserType("FORM_MODEL");
        user.setVerificationStatus(Constants.VerificationStatuses.APPROVED);

        KycSession existing = new KycSession();
        existing.setUserId(104L);
        existing.setProvider("DIDIT");
        existing.setSessionType(Constants.SessionTypes.MODEL);
        existing.setKycStatus(Constants.VerificationStatuses.APPROVED);
        existing.setProviderStatus("Approved");
        existing.setProviderSessionId("didit-sess-prev");

        when(userRepository.findById(104L)).thenReturn(Optional.of(user));
        when(kycSessionRepository.findTopByUserIdAndSessionTypeOrderByIdDesc(
                104L, Constants.SessionTypes.MODEL)).thenReturn(Optional.of(existing));
        when(emailCopyRenderer.renderModelReviewDecision(any(User.class), eq("REPEAT")))
                .thenReturn(new EmailCopyRenderer.EmailContent(
                        "Necesitamos repetir tu verificación", "<p>body repeat</p>"));

        adminService.reviewModel(104L, "REPEAT");

        assertEquals(null, user.getVerificationStatus());
        assertEquals(Constants.Roles.USER, user.getRole());
        assertEquals("CANCELLED", existing.getKycStatus());

        ArgumentCaptor<EmailMessage> captor = ArgumentCaptor.forClass(EmailMessage.class);
        verify(emailService, times(1)).send(captor.capture());
        EmailMessage sent = captor.getValue();
        assertEquals("demo+repeat@sharemechat.com", sent.to());
        assertEquals(EmailMessage.Category.MODEL_REVIEW_REPEAT, sent.category());
        assertEquals(EmailMessage.Priority.BEST_EFFORT, sent.priority());
        assertEquals("Necesitamos repetir tu verificación", sent.subject());
    }

    @Test
    @DisplayName("APPROVE: si emailService lanza, reviewModel NO rollback y verification_status sigue APPROVED")
    void approveEmailFailureDoesNotRollback() {
        User user = newPendingModel(103L, "demo+model4@sharemechat.com");
        when(userRepository.findById(103L)).thenReturn(Optional.of(user));
        when(modelRepository.existsById(103L)).thenReturn(true);
        when(emailCopyRenderer.renderModelReviewDecision(any(User.class), eq("APPROVE")))
                .thenReturn(new EmailCopyRenderer.EmailContent("subject", "<p>body</p>"));
        doThrow(new RuntimeException("graph down"))
                .when(emailService).send(any(EmailMessage.class));

        assertDoesNotThrow(() -> adminService.reviewModel(103L, "APPROVE"));

        assertEquals(Constants.VerificationStatuses.APPROVED, user.getVerificationStatus());
        assertEquals(Constants.Roles.MODEL, user.getRole());
        verify(userRepository, times(1)).save(user);
    }
}
