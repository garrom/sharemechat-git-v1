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

    public static class ModelTierSnapshotSummary {
        public String snapshotDate;          // YYYY-MM-DD (ayer)
        public Integer billedMinutes30d;     // minutos en ventana 30d
        public String billedHours30d;        // "12.50"
        public String tierName;              // "BASE" / "7 - 20"
        public String firstMinuteEURPerMin;  // "0.0500"
        public String nextMinutesEURPerMin;  // "0.1500"
    }

    public static class ModelTierStats {
        public ModelTierSnapshotSummary current;       // snapshot efectivo (ayer)
        public java.util.List<ModelTierHistoryRow> history; // últimos N snapshots
        public java.util.List<TierRow> tiers;          // tiers activos (o todos)
    }

    public static class ModelTierHistoryRow {
        public String snapshotDate;
        public Integer billedMinutes30d;
        public String tierName;
    }

    public static class TierRow {
        public Long tierId;
        public String name;
        public Integer minBilledMinutes;
        public String firstMinuteEURPerMin;
        public String nextMinutesEURPerMin;
        public Boolean active;
    }


}
