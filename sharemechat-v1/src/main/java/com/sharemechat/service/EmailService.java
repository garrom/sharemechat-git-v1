package com.sharemechat.service;

public interface EmailService {
    void send(String to, String subject, String htmlBody);
}
