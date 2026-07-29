package com.sharemechat.master.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * ADR-056 D6: aceptacion inmutable del contrato Master ↔ SharemeChat.
 * Simetrico a {@code ModelContractAcceptance}. Guarda snapshot del hash
 * sha256 del PDF que el Master firmo — permite reconstruir a posteriori
 * que texto exacto acepto un Master en fecha X.
 */
@Entity
@Table(name = "master_contract_acceptances")
public class MasterContractAcceptance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "contract_version", nullable = false, length = 50)
    private String contractVersion;

    @Column(name = "contract_sha256", nullable = false, length = 64)
    private String contractSha256;

    @Column(name = "accepted_at", nullable = false)
    private LocalDateTime acceptedAt;

    @Column(name = "ip_address", length = 64)
    private String ipAddress;

    @Column(name = "user_agent", length = 255)
    private String userAgent;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public MasterContractAcceptance() {}

    public Long getId() { return id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getContractVersion() { return contractVersion; }
    public void setContractVersion(String contractVersion) { this.contractVersion = contractVersion; }

    public String getContractSha256() { return contractSha256; }
    public void setContractSha256(String contractSha256) { this.contractSha256 = contractSha256; }

    public LocalDateTime getAcceptedAt() { return acceptedAt; }
    public void setAcceptedAt(LocalDateTime acceptedAt) { this.acceptedAt = acceptedAt; }

    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }

    public String getUserAgent() { return userAgent; }
    public void setUserAgent(String userAgent) { this.userAgent = userAgent; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
