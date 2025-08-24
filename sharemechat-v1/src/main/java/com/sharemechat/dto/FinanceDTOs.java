// src/main/java/com/sharemechat/dto/FinanceDTOs.java
package com.sharemechat.dto;

import java.math.BigDecimal;

public class FinanceDTOs {
    public static class TopModel {
        public Long modelId;
        public String email, name, nickname;
        public String totalEarningsEUR;
    }
    public static class TopClient {
        public Long clientId;
        public String email, name, nickname;
        public String totalPagosEUR;
    }
    public static class Summary {
        public String grossBillingEUR; // facturación total (clientes)
        public String netProfitEUR;    // margen plataforma
    }
}
