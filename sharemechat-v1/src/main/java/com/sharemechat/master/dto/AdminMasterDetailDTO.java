package com.sharemechat.master.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * ADR-056 S7.a: detalle drill-down de un Master. Extiende
 * {@link AdminMasterListItemDTO} con lista de modelos bajo su cuenta
 * y KPIs económicos 30d.
 */
public class AdminMasterDetailDTO {

    private AdminMasterListItemDTO master;
    private List<ModelUnderMasterItem> models;
    private BigDecimal billedGrossEur30d;
    private int payoutRequestsLast30d;

    public AdminMasterListItemDTO getMaster() { return master; }
    public void setMaster(AdminMasterListItemDTO master) { this.master = master; }

    public List<ModelUnderMasterItem> getModels() { return models; }
    public void setModels(List<ModelUnderMasterItem> models) { this.models = models; }

    public BigDecimal getBilledGrossEur30d() { return billedGrossEur30d; }
    public void setBilledGrossEur30d(BigDecimal billedGrossEur30d) { this.billedGrossEur30d = billedGrossEur30d; }

    public int getPayoutRequestsLast30d() { return payoutRequestsLast30d; }
    public void setPayoutRequestsLast30d(int payoutRequestsLast30d) { this.payoutRequestsLast30d = payoutRequestsLast30d; }

    /**
     * Proyección de una modelo bajo la cuenta del Master, sin PII.
     * Alineado con MasterModelViewDTO pero exponible al admin (no al
     * Master ni a la propia modelo).
     */
    public static class ModelUnderMasterItem {
        private Long modelUserId;
        private String nickname;
        private boolean active;
        private String verificationStatus;
        private BigDecimal internalSharePct;
        private BigDecimal chosenRateEurPerMin;
        private LocalDateTime createdAt;

        public Long getModelUserId() { return modelUserId; }
        public void setModelUserId(Long modelUserId) { this.modelUserId = modelUserId; }

        public String getNickname() { return nickname; }
        public void setNickname(String nickname) { this.nickname = nickname; }

        public boolean isActive() { return active; }
        public void setActive(boolean active) { this.active = active; }

        public String getVerificationStatus() { return verificationStatus; }
        public void setVerificationStatus(String verificationStatus) { this.verificationStatus = verificationStatus; }

        public BigDecimal getInternalSharePct() { return internalSharePct; }
        public void setInternalSharePct(BigDecimal internalSharePct) { this.internalSharePct = internalSharePct; }

        public BigDecimal getChosenRateEurPerMin() { return chosenRateEurPerMin; }
        public void setChosenRateEurPerMin(BigDecimal chosenRateEurPerMin) { this.chosenRateEurPerMin = chosenRateEurPerMin; }

        public LocalDateTime getCreatedAt() { return createdAt; }
        public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    }
}
