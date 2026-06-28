package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.Complaint;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Set;

/**
 * Email transaccional del frente Complaints (Opcion B).
 *
 * <ul>
 *   <li>{@link #sendAckToReporter(Complaint)}: ack al denunciante si
 *       facilito email (DEC-7). Bilingue es/en por heuristica simple
 *       de TLD (default en).</li>
 *   <li>{@link #sendAdminAlertForCritical(Complaint)}: alerta al alias
 *       interno {@code complaints.email.admin-alert.to} solo para
 *       categorias graves CSAM / NON_CONSENSUAL / MINOR_AT_RISK
 *       (DEC-8).</li>
 * </ul>
 *
 * <p>Reusa {@link EmailService} (interface) cuya implementacion en
 * runtime depende de {@code email.provider} (graph/smtp/logging).
 * Best-effort: si el envio falla, log warn y continuar (la complaint
 * persiste).
 */
@Service
public class ComplaintMailService {

    private static final Logger log = LoggerFactory.getLogger(ComplaintMailService.class);

    private static final Set<String> CRITICAL_CATEGORIES = Set.of(
            Constants.ComplaintCategories.CSAM,
            Constants.ComplaintCategories.NON_CONSENSUAL,
            Constants.ComplaintCategories.MINOR_AT_RISK
    );

    private final EmailService emailService;

    @Value("${complaints.email.from:safety@sharemechat.com}")
    private String fromAddress;

    @Value("${complaints.email.admin-alert.to:safety@sharemechat.com}")
    private String adminAlertTo;

    public ComplaintMailService(EmailService emailService) {
        this.emailService = emailService;
    }

    public void sendAckToReporter(Complaint complaint) {
        if (complaint == null) return;
        String to = complaint.getReporterEmail();
        if (to == null || to.isBlank()) {
            log.debug("[COMPLAINT-MAIL] reporter sin email; ack no enviado complaintId={}", complaint.getId());
            return;
        }
        try {
            boolean es = isLikelyEsLocale(to);
            String subject = es
                    ? "Hemos recibido tu denuncia (ID " + complaint.getId() + ")"
                    : "We have received your complaint (ID " + complaint.getId() + ")";
            String body = es
                    ? buildEsBody(complaint)
                    : buildEnBody(complaint);

            EmailMessage msg = new EmailMessage(
                    to.trim(),
                    subject,
                    body,
                    EmailMessage.Category.COMPLAINT_ACK,
                    EmailMessage.Priority.BEST_EFFORT,
                    fromAddress,
                    fromAddress);
            emailService.send(msg);
            log.info("[COMPLAINT-MAIL] ack enviado complaintId={} to=<set>", complaint.getId());
        } catch (Exception ex) {
            log.warn("[COMPLAINT-MAIL] ack FAIL complaintId={}: {}",
                    complaint.getId(), ex.getMessage());
        }
    }

    public boolean sendAdminAlertForCritical(Complaint complaint) {
        if (complaint == null) return false;
        if (!CRITICAL_CATEGORIES.contains(complaint.getCategory())) {
            return false;
        }
        try {
            String subject = "[SAFETY] Critical complaint received - "
                    + complaint.getCategory() + " (ID " + complaint.getId() + ")";
            String body = "<p>A complaint with critical category has been received and requires immediate review.</p>"
                    + "<ul>"
                    + "<li><b>ID:</b> " + complaint.getId() + "</li>"
                    + "<li><b>Category:</b> " + safe(complaint.getCategory()) + "</li>"
                    + "<li><b>Status:</b> " + safe(complaint.getStatus()) + "</li>"
                    + "<li><b>Channel:</b> " + safe(complaint.getChannel()) + "</li>"
                    + "<li><b>Subject user id:</b> " + (complaint.getSubjectUserId() != null ? complaint.getSubjectUserId() : "&mdash;") + "</li>"
                    + "<li><b>Subject stream id:</b> " + (complaint.getSubjectStreamRecordId() != null ? complaint.getSubjectStreamRecordId() : "&mdash;") + "</li>"
                    + "</ul>"
                    + "<p>Please review immediately in the backoffice: <code>/admin/complaints/" + complaint.getId() + "</code>.</p>";

            EmailMessage msg = new EmailMessage(
                    adminAlertTo.trim(),
                    subject,
                    body,
                    EmailMessage.Category.COMPLAINT_ADMIN_ALERT,
                    EmailMessage.Priority.CRITICAL,
                    fromAddress,
                    fromAddress);
            emailService.send(msg);
            log.info("[COMPLAINT-MAIL] admin-alert enviado complaintId={} category={}",
                    complaint.getId(), complaint.getCategory());
            return true;
        } catch (Exception ex) {
            log.warn("[COMPLAINT-MAIL] admin-alert FAIL complaintId={}: {}",
                    complaint.getId(), ex.getMessage());
            return false;
        }
    }

    static boolean isLikelyEsLocale(String email) {
        if (email == null) return false;
        String e = email.toLowerCase(java.util.Locale.ROOT);
        return e.endsWith(".es") || e.endsWith(".mx") || e.endsWith(".ar")
                || e.endsWith(".co") || e.endsWith(".cl") || e.endsWith(".pe")
                || e.endsWith(".uy") || e.endsWith(".ec") || e.endsWith(".ve");
    }

    private String buildEsBody(Complaint c) {
        return "<p>Hola,</p>"
                + "<p>Hemos recibido tu denuncia con identificador "
                + "<b>#" + c.getId() + "</b>. La revisaremos en un plazo maximo "
                + "de <b>5 dias habiles</b> y nos pondremos en contacto contigo "
                + "si necesitamos mas informacion o cuando se cierre el caso.</p>"
                + "<p>Gracias por ayudarnos a mantener SharemeChat seguro para "
                + "nuestra comunidad.</p>"
                + "<p>Equipo de Confianza y Seguridad &mdash; SharemeChat</p>";
    }

    private String buildEnBody(Complaint c) {
        return "<p>Hello,</p>"
                + "<p>We have received your complaint with identifier "
                + "<b>#" + c.getId() + "</b>. We will review it within "
                + "<b>5 business days</b> and contact you if we need additional "
                + "information or when the case is resolved.</p>"
                + "<p>Thank you for helping us keep SharemeChat safe for our "
                + "community.</p>"
                + "<p>Trust &amp; Safety Team &mdash; SharemeChat</p>";
    }

    private static String safe(String s) {
        return s == null ? "&mdash;" : s.replace("<", "&lt;").replace(">", "&gt;");
    }
}
