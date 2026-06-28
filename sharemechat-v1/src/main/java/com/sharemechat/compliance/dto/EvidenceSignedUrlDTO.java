package com.sharemechat.compliance.dto;

import java.time.LocalDateTime;

/**
 * Respuesta del endpoint signed URL (DEC-CD-C: 200 con url=null si el
 * evento es GREEN y no tiene evidence_ref).
 */
public class EvidenceSignedUrlDTO {

    private String url;
    private String reason;
    private LocalDateTime expiresAt;
    private Long ttlSeconds;

    public EvidenceSignedUrlDTO() {}

    public EvidenceSignedUrlDTO(String url, String reason, LocalDateTime expiresAt, Long ttlSeconds) {
        this.url = url;
        this.reason = reason;
        this.expiresAt = expiresAt;
        this.ttlSeconds = ttlSeconds;
    }

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
    public Long getTtlSeconds() { return ttlSeconds; }
    public void setTtlSeconds(Long ttlSeconds) { this.ttlSeconds = ttlSeconds; }
}
