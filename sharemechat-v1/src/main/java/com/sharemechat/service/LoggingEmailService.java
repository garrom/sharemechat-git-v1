package com.sharemechat.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class LoggingEmailService implements EmailService {

    private static final Logger log = LoggerFactory.getLogger(LoggingEmailService.class);

    @Override
    public void send(String to, String subject, String htmlBody) {

        log.info("""
                === EMAIL (FAKE) ===
                To: {}
                Subject: {}
                Body:
                {}
                ====================
                """, to, subject, htmlBody);
    }
}