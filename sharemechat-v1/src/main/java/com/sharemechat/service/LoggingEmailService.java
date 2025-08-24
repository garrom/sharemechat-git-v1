package com.sharemechat.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service // Implementación por defecto del EmailService
public class LoggingEmailService implements EmailService {

    private static final Logger log = LoggerFactory.getLogger(LoggingEmailService.class);

    @Override
    public void send(String to, String subject, String htmlBody) {
        // Por ahora solo logueamos el “correo”
        log.info("=== EMAIL (FAKE) ===\nTo: {}\nSubject: {}\nBody:\n{}\n====================",
                to, subject, htmlBody);
    }
}
