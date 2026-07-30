package com.sharemechat.master.dto;

import java.math.BigDecimal;

/**
 * ADR-056 S5.a.2: perfil + saldo del Master autenticado.
 * Simétrico a {@link com.sharemechat.dto.ClientDTO} y
 * {@link com.sharemechat.dto.ModelDTO}.
 */
public class MasterMeDTO {

    private Long userId;
    private String email;
    private String nickname;
    private String accountStatus;
    private String verificationStatus;
    private Boolean contractAccepted;
    private BigDecimal saldoActual;
    private String companyName;
    private String companyCountry;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }

    public String getAccountStatus() { return accountStatus; }
    public void setAccountStatus(String accountStatus) { this.accountStatus = accountStatus; }

    public String getVerificationStatus() { return verificationStatus; }
    public void setVerificationStatus(String verificationStatus) { this.verificationStatus = verificationStatus; }

    public Boolean getContractAccepted() { return contractAccepted; }
    public void setContractAccepted(Boolean contractAccepted) { this.contractAccepted = contractAccepted; }

    public BigDecimal getSaldoActual() { return saldoActual; }
    public void setSaldoActual(BigDecimal saldoActual) { this.saldoActual = saldoActual; }

    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }

    public String getCompanyCountry() { return companyCountry; }
    public void setCompanyCountry(String companyCountry) { this.companyCountry = companyCountry; }
}
