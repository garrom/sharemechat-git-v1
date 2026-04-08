package com.sharemechat.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class LoggingEmailService implements EmailService {

    private static final Logger log = LoggerFactory.getLogger(LoggingEmailService.class);

    @Override
    public void send(EmailMessage message) {

        log.info("""
                === EMAIL (FAKE) ===
                To: {}
                Subject: {}
                Category: {}
                Priority: {}
                Body:
                {}
                ====================
                """, message.to(), message.subject(), message.category(), message.priority(), message.htmlBody());
    }
}
