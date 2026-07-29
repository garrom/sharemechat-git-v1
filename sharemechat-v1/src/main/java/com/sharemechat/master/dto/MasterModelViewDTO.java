package com.sharemechat.master.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * ADR-056 D9: proyeccion de una modelo bajo umbrella del Master. Expone
 * SOLO datos operativos. Excluye por diseno los campos PII (nombre real,
 * apellidos, DoB, DNI, email personal, telefono, direccion). Alineado
 * con LiveJasmin post-registro.
 */
public class MasterModelViewDTO {

    private Long modelUserId;
    private String nickname;
    private String verificationStatus;      // PENDING | APPROVED | REJECTED
    private boolean isActive;
    private String accountStatus;            // ACTIVE | SUSPENDED | BANNED
    private BigDecimal chosenRateEurPerMin;
    private BigDecimal streamingHours;       // metrica operativa
    private BigDecimal internalSharePctPactado; // % vigente Master paga a la modelo
    private LocalDateTime createdAt;

    public Long getModelUserId() { return modelUserId; }
    public void setModelUserId(Long modelUserId) { this.modelUserId = modelUserId; }

    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }

    public String getVerificationStatus() { return verificationStatus; }
    public void setVerificationStatus(String verificationStatus) { this.verificationStatus = verificationStatus; }

    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { isActive = active; }

    public String getAccountStatus() { return accountStatus; }
    public void setAccountStatus(String accountStatus) { this.accountStatus = accountStatus; }

    public BigDecimal getChosenRateEurPerMin() { return chosenRateEurPerMin; }
    public void setChosenRateEurPerMin(BigDecimal chosenRateEurPerMin) { this.chosenRateEurPerMin = chosenRateEurPerMin; }

    public BigDecimal getStreamingHours() { return streamingHours; }
    public void setStreamingHours(BigDecimal streamingHours) { this.streamingHours = streamingHours; }

    public BigDecimal getInternalSharePctPactado() { return internalSharePctPactado; }
    public void setInternalSharePctPactado(BigDecimal internalSharePctPactado) { this.internalSharePctPactado = internalSharePctPactado; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
