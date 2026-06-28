package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.Complaint;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ComplaintMailServiceTest {

    private EmailService emailService;
    private ComplaintMailService svc;

    @BeforeEach
    void setUp() {
        emailService = mock(EmailService.class);
        svc = new ComplaintMailService(emailService);
        ReflectionTestUtils.setField(svc, "fromAddress", "safety@sharemechat.com");
        ReflectionTestUtils.setField(svc, "adminAlertTo", "safety@sharemechat.com");
    }

    private Complaint complaint(Long id, String category, String reporterEmail) {
        Complaint c = new Complaint();
        try {
            java.lang.reflect.Field f = Complaint.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(c, id);
        } catch (Exception ignore) {}
        c.setCategory(category);
        c.setReporterEmail(reporterEmail);
        c.setStatus(Constants.ComplaintStatuses.OPEN);
        c.setChannel(Constants.ComplaintChannels.WEB);
        return c;
    }

    @Test
    @DisplayName("sendAckToReporter con email -> EmailService.send invocado con categoria COMPLAINT_ACK")
    void ackSentIfEmailPresent() {
        svc.sendAckToReporter(complaint(7L, Constants.ComplaintCategories.HARASSMENT, "reporter@example.com"));

        ArgumentCaptor<EmailMessage> capt = ArgumentCaptor.forClass(EmailMessage.class);
        verify(emailService, times(1)).send(capt.capture());
        EmailMessage msg = capt.getValue();
        assertEquals(EmailMessage.Category.COMPLAINT_ACK, msg.category());
        assertEquals("reporter@example.com", msg.to());
        assertTrue(msg.subject().contains("7"));
    }

    @Test
    @DisplayName("sendAckToReporter sin email -> NO se invoca EmailService")
    void ackNotSentIfEmailMissing() {
        svc.sendAckToReporter(complaint(7L, Constants.ComplaintCategories.HARASSMENT, null));
        verify(emailService, never()).send(any(EmailMessage.class));
    }

    @Test
    @DisplayName("sendAckToReporter email .es -> body en español")
    void esLocaleHeuristic() {
        svc.sendAckToReporter(complaint(7L, Constants.ComplaintCategories.HARASSMENT, "user@example.es"));
        ArgumentCaptor<EmailMessage> capt = ArgumentCaptor.forClass(EmailMessage.class);
        verify(emailService).send(capt.capture());
        assertTrue(capt.getValue().htmlBody().contains("Hola"));
    }

    @Test
    @DisplayName("sendAckToReporter email .com -> body en inglés (default)")
    void enLocaleDefault() {
        svc.sendAckToReporter(complaint(7L, Constants.ComplaintCategories.HARASSMENT, "user@example.com"));
        ArgumentCaptor<EmailMessage> capt = ArgumentCaptor.forClass(EmailMessage.class);
        verify(emailService).send(capt.capture());
        assertTrue(capt.getValue().htmlBody().contains("Hello"));
    }

    @Test
    @DisplayName("sendAdminAlertForCritical CSAM -> envia + devuelve true")
    void alertSentForCsam() {
        boolean sent = svc.sendAdminAlertForCritical(complaint(7L, Constants.ComplaintCategories.CSAM, null));
        assertTrue(sent);
        ArgumentCaptor<EmailMessage> capt = ArgumentCaptor.forClass(EmailMessage.class);
        verify(emailService).send(capt.capture());
        assertEquals(EmailMessage.Category.COMPLAINT_ADMIN_ALERT, capt.getValue().category());
        assertEquals(EmailMessage.Priority.CRITICAL, capt.getValue().priority());
    }

    @Test
    @DisplayName("sendAdminAlertForCritical NON_CONSENSUAL -> envia")
    void alertSentForNonConsensual() {
        boolean sent = svc.sendAdminAlertForCritical(complaint(7L, Constants.ComplaintCategories.NON_CONSENSUAL, null));
        assertTrue(sent);
    }

    @Test
    @DisplayName("sendAdminAlertForCritical MINOR_AT_RISK -> envia")
    void alertSentForMinor() {
        boolean sent = svc.sendAdminAlertForCritical(complaint(7L, Constants.ComplaintCategories.MINOR_AT_RISK, null));
        assertTrue(sent);
    }

    @Test
    @DisplayName("sendAdminAlertForCritical HARASSMENT (no crítico) -> NO envía + devuelve false")
    void alertNotSentForNonCritical() {
        boolean sent = svc.sendAdminAlertForCritical(complaint(7L, Constants.ComplaintCategories.HARASSMENT, null));
        assertFalse(sent);
        verify(emailService, never()).send(any(EmailMessage.class));
    }

    @Test
    @DisplayName("isLikelyEsLocale helper")
    void localeHelper() {
        assertTrue(ComplaintMailService.isLikelyEsLocale("a@b.es"));
        assertTrue(ComplaintMailService.isLikelyEsLocale("user@mail.mx"));
        assertFalse(ComplaintMailService.isLikelyEsLocale("a@b.com"));
        assertFalse(ComplaintMailService.isLikelyEsLocale(null));
    }
}
