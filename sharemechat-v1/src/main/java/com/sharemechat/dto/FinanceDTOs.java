package com.sharemechat.dto;

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

    // ADR-052 (2026-07-25 limpieza): DTO del tab Historico del panel
    // Estadisticas del modelo. Retirados ModelTierSnapshotSummary y
    // TierRow tras la iter.2: el snapshot actual y el catalogo de tramos
    // se sirven ahora desde PricingService (/model/economics), no aqui.
    public static class ModelTierStats {
        public java.util.List<ModelTierHistoryRow> history; // últimos N snapshots
    }

    public static class ModelTierHistoryRow {
        public String snapshotDate;
        public Integer billedMinutes30d;
        public String tierName;
    }
}
