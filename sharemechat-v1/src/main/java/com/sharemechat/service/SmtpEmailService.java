package com.sharemechat.service;

import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(prefix = "email", name = "provider", havingValue = "smtp")
public class SmtpEmailService implements EmailService {

    private static final Logger log = LoggerFactory.getLogger(SmtpEmailService.class);

    private final JavaMailSender mailSender;

    @Value("${email.default-from:operations@sharemechat.com}")
    private String defaultFrom;

    public SmtpEmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    @Override
    public void send(EmailMessage message) {

        try {

            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");

            helper.setTo(message.to());
            helper.setFrom(message.from() != null && !message.from().isBlank() ? message.from() : defaultFrom);
            if (message.replyTo() != null && !message.replyTo().isBlank()) {
                helper.setReplyTo(message.replyTo());
            }
            helper.setSubject(message.subject());
            helper.setText(message.htmlBody(), true);

            mailSender.send(mimeMessage);
            log.info("EMAIL_SENT provider=smtp category={} priority={} to={} sender={}",
                    message.category(), message.priority(), message.to(),
                    message.from() != null && !message.from().isBlank() ? message.from() : defaultFrom);

        } catch (Exception e) {
            EmailDeliveryException ex = new EmailDeliveryException("smtp", message, e.getMessage(), e);
            log.warn("EMAIL_SEND_FAIL {}", ex.getMessage());
            throw ex;
        }
    }
}
