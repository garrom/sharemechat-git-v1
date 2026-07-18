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
        ACCOUNT_ALREADY_EXISTS_NOTICE,
        MODEL_REVIEW_APPROVED,
        MODEL_REVIEW_REJECTED,
        MODEL_REVIEW_REPEAT,
        // Sub-paquete Complaints workflow (Opcion B). DEC-7: ack al denunciante
        // cuando dio email. DEC-8: alerta interna al admin si categoria grave.
        COMPLAINT_ACK,
        COMPLAINT_ADMIN_ALERT,
        // ADR-049 Subpasada 2B: programa de afiliadas. Magic link temprano
        // enviado al visitante que deja email en la landing publica (D12).
        // Priority CRITICAL: si falla, el flujo del pipeline debe abortar.
        // Copy en `renderReferralMagicLink` (ES/EN). Copy actual marcada como
        // known-debt: placeholders tecnicos pendientes de revision editorial.
        REFERRAL_MAGIC_LINK,
        // ADR-049 Subpasada 2B: email de invitacion al cliente recien
        // registrado con atribucion a modelo referidora (D6). Priority
        // BEST_EFFORT: fallo del envio NO revierte la atribucion en BD.
        // Copy en `renderReferralInvitation` (ES/EN), tambien pendiente de
        // revision editorial (mismo item de known-debt).
        REFERRAL_INVITATION,
        // Notificacion INTERNA al equipo (admin+clientes@ o admin+modelos@)
        // cuando alguien completa el formulario publico de registro. Copy
        // en ES fijo (destinatario interno hispanohablante). Priority
        // BEST_EFFORT: fallo del envio NO revierte el registro. Direccion
        // destino configurable via notifications.admin.new-client-email /
        // new-model-email; si la property viene vacia, el envio se skipea
        // (comportamiento por defecto en TEST/AUDIT).
        ADMIN_NEW_CLIENT_REGISTERED,
        ADMIN_NEW_MODEL_REGISTERED
    }

    public enum Priority {
        BEST_EFFORT,
        CRITICAL
    }
}
