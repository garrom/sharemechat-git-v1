package com.sharemechat.service;

public record EmailMessage(
        String to,
        String subject,
        String htmlBody,
        Category category,
        Priority priority,
        String from,
        String replyTo
) {

    public EmailMessage {
        if (to == null || to.isBlank()) {
            throw new IllegalArgumentException("Email to es obligatorio");
        }
        if (subject == null || subject.isBlank()) {
            throw new IllegalArgumentException("Email subject es obligatorio");
        }
        if (htmlBody == null || htmlBody.isBlank()) {
            throw new IllegalArgumentException("Email htmlBody es obligatorio");
        }
        if (category == null) {
            throw new IllegalArgumentException("Email category es obligatorio");
        }
        if (priority == null) {
            throw new IllegalArgumentException("Email priority es obligatorio");
        }
    }

    public EmailMessage(String to,
                        String subject,
                        String htmlBody,
                        Category category,
                        Priority priority) {
        this(to, subject, htmlBody, category, priority, null, null);
    }

    public enum Category {
        WELCOME,
        UNSUBSCRIBE_CONFIRMATION,
        EMAIL_VERIFICATION,
        PASSWORD_RESET,
        MODEL_ASSET_REJECTION,
        // H1 hardening Lote 2 (2026-06-08): notificacion enviada al
        // email YA EXISTENTE cuando alguien intenta registrarse de
        // nuevo con esa direccion. Indistinguible para el remitente
        // del registro respecto al alta normal (mismo status + body),
        // pero el destinatario real recibe este aviso aparte.
        ACCOUNT_ALREADY_EXISTS_NOTICE
    }

    public enum Priority {
        BEST_EFFORT,
        CRITICAL
    }
}
