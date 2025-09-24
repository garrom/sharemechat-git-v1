package com.sharemechat.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "consent_events")
public class ConsentEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_type", nullable = false, length = 32)
    private String eventType; // 'age_gate_accept' | 'terms_accept'

    @Column(name = "version", length = 20)
    private String version;   // 'v1', etc. (null para age_gate si no aplica)

    @Column(name = "consent_id", nullable = false, length = 64)
    private String consentId; // UUID anónimo del cliente

    @Column(name = "ts", nullable = false)
    private Instant ts;       // timestamp del evento

    @Column(name = "user_agent", length = 255)
    private String userAgent;

    @Column(name = "ip_hint", length = 64)
    private String ipHint;    // IPv4 /24, IPv6 /48, o hash

    @Column(name = "path", length = 255)
    private String path;      // ruta donde se aceptó

    @Column(name = "sig", nullable = false, length = 128)
    private String sig;       // HMAC de los campos canónicos

    public ConsentEvent() {}

    // --- Getters/Setters ---
    public Long getId() { return id; }

    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }

    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }

    public String getConsentId() { return consentId; }
    public void setConsentId(String consentId) { this.consentId = consentId; }

    public Instant getTs() { return ts; }
    public void setTs(Instant ts) { this.ts = ts; }

    public String getUserAgent() { return userAgent; }
    public void setUserAgent(String userAgent) { this.userAgent = userAgent; }

    public String getIpHint() { return ipHint; }
    public void setIpHint(String ipHint) { this.ipHint = ipHint; }

    public String getPath() { return path; }
    public void setPath(String path) { this.path = path; }

    public String getSig() { return sig; }
    public void setSig(String sig) { this.sig = sig; }

    @PrePersist
    public void prePersist() {
        if (this.ts == null) this.ts = Instant.now();
    }

}
