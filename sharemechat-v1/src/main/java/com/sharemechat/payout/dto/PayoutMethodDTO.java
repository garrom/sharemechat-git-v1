package com.sharemechat.payout.dto;

import java.time.LocalDateTime;

/**
 * ADR-056 S6.a: proyección de PayoutMethod expuesta al cliente Master
 * autoservicio. No expone el userId (implícito por el endpoint /me).
 */
public class PayoutMethodDTO {

    private Long id;
    private String rail;
    private String accountRef;
    private String displayAlias;
    private boolean isDefault;
    private LocalDateTime verifiedAt;
    private LocalDateTime createdAt;

    public PayoutMethodDTO() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getRail() { return rail; }
    public void setRail(String rail) { this.rail = rail; }

    public String getAccountRef() { return accountRef; }
    public void setAccountRef(String accountRef) { this.accountRef = accountRef; }

    public String getDisplayAlias() { return displayAlias; }
    public void setDisplayAlias(String displayAlias) { this.displayAlias = displayAlias; }

    public boolean isDefault() { return isDefault; }
    public void setDefault(boolean isDefault) { this.isDefault = isDefault; }

    public LocalDateTime getVerifiedAt() { return verifiedAt; }
    public void setVerifiedAt(LocalDateTime verifiedAt) { this.verifiedAt = verifiedAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
