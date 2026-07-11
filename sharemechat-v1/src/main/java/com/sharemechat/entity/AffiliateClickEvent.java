package com.sharemechat.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * ADR-049 Subpasada 1 D15: log de eventos del funnel de afiliacion.
 *
 * <p>Estados posibles del campo {@code eventType}:
 * <ul>
 *   <li>{@code CLICK} — visita a la landing con {@code ?ref=<code>}.</li>
 *   <li>{@code EMAIL_SUBMITTED} — visitante mete email en la landing.</li>
 *   <li>{@code LINK_CONSUMED} — visitante abre el magic link en otro dispositivo.</li>
 *   <li>{@code REGISTERED} — cliente se registra atribuido a la modelo.</li>
 *   <li>{@code FIRST_PAYMENT} — cliente atribuido realiza su primera compra.</li>
 * </ul>
 *
 * <p>Los campos {@code ipHash} y {@code uaHash} guardan SHA-256 truncado a
 * 16 caracteres hexadecimales (64 bits). No reversibles. Suficientes para
 * agregacion anti-abuso ("mismo device 50 clicks en 1 hora?") sin persistir
 * PII. Nunca se guarda IP plana ni User-Agent en claro.
 */
@Entity
@Table(name = "affiliate_click_events")
public class AffiliateClickEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** userId de la modelo afiliada asociada al codigo del click. */
    @Column(name = "model_user_id", nullable = false)
    private Long modelUserId;

    /** CLICK / EMAIL_SUBMITTED / LINK_CONSUMED / REGISTERED / FIRST_PAYMENT. */
    @Column(name = "event_type", nullable = false, length = 20)
    private String eventType;

    /** userId del cliente post-atribucion. NULL en CLICK/EMAIL_SUBMITTED. */
    @Column(name = "client_user_id")
    private Long clientUserId;

    /**
     * SHA-256(ip + salt) truncado a 16 chars hex. NULL si no aplica.
     *
     * <p><b>columnDefinition CHAR(16)</b>: la V16 declara CHAR(16) porque el
     * hash truncado tiene longitud fija (siempre 16 hex chars). Sin este
     * columnDefinition, Hibernate mapea String con length=16 como VARCHAR(16)
     * y Spring rompe el arranque con Schema-validation ({@code found char,
     * but expecting varchar}). Regresion detectada durante el smoke de la
     * subpasada 2A el 2026-07-11 en TEST.
     */
    @Column(name = "ip_hash", length = 16, columnDefinition = "CHAR(16)")
    private String ipHash;

    /**
     * SHA-256(user_agent + salt) truncado a 16 chars hex. Opcional.
     * Mismo motivo que {@code ipHash} para {@code columnDefinition = "CHAR(16)"}.
     */
    @Column(name = "ua_hash", length = 16, columnDefinition = "CHAR(16)")
    private String uaHash;

    @Column(name = "created_at", nullable = false, updatable = false,
            columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt;

    public AffiliateClickEvent() {
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }

    public Long getModelUserId() { return modelUserId; }
    public void setModelUserId(Long modelUserId) { this.modelUserId = modelUserId; }

    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }

    public Long getClientUserId() { return clientUserId; }
    public void setClientUserId(Long clientUserId) { this.clientUserId = clientUserId; }

    public String getIpHash() { return ipHash; }
    public void setIpHash(String ipHash) { this.ipHash = ipHash; }

    public String getUaHash() { return uaHash; }
    public void setUaHash(String uaHash) { this.uaHash = uaHash; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
