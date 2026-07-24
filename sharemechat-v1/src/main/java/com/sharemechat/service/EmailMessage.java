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
        // REFERRAL_MAGIC_LINK + REFERRAL_INVITATION retiradas el 2026-07-24
        // junto con el resto del programa de afiliadas ([ADR-052 §D11]).
        // Notificacion INTERNA al equipo (admin+clientes@ o admin+modelos@)
        // cuando alguien completa el formulario publico de registro. Copy
        // en ES fijo (destinatario interno hispanohablante). Priority
        // BEST_EFFORT: fallo del envio NO revierte el registro. Direccion
        // destino configurable via notifications.admin.new-client-email /
        // new-model-email; si la property viene vacia, el envio se skipea
        // (comportamiento por defecto en TEST/AUDIT).
        ADMIN_NEW_CLIENT_REGISTERED,
        ADMIN_NEW_MODEL_REGISTERED,
        // ADR-037 Fase 5 Bloque 5 Paso 3: aviso automatico al buzon
        // admin+moderacion@ cuando el consumo Sightengine cruza un umbral
        // configurado (60/85/95% mes o 80% dia). Priority BEST_EFFORT:
        // si falla el envio, el job hace rollback de la row en
        // moderation_usage_alerts para reintentar en la proxima pasada.
        ADMIN_MODERATION_QUOTA_ALERT,
        // ADR-037 frente trial-sfw Bloque 3 Paso 2: aviso a la modelo cuando
        // el motor emite un ban automatico por infraccion CRITICAL en trial.
        // Priority BEST_EFFORT: si falla el envio, el ban ya se persistio y
        // la modelo lo vera igual in-app al intentar entrar al matching.
        MODEL_STREAMING_BAN,
        // ADR-037 frente trial-sfw Bloque 4: notificacion a la modelo cuando
        // un admin levanta su ban tras revision manual (falso positivo o
        // apelacion aceptada). Priority BEST_EFFORT.
        MODEL_STREAMING_BAN_LIFTED
    }

    public enum Priority {
        BEST_EFFORT,
        CRITICAL
    }
}
